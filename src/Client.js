
import bcrypt from "bcryptjs";
import dateformat from "dateformat";
import util from "util";
import WebSocket from "ws";

import db from "./db.js";
import Group from "./Group.js";
import Room from "./Room.js";
import { colors, instance } from "./util.js";

const clients = [];
const groups = Group.instances;
const rooms = Room.instances;

export default class Client {

	constructor( socket ) {

		this.account = undefined;
		this.id = undefined;
		this.mode = "normal";
		this.host = false;
		this.group = null;
		this.friends = [];

		clients.push( this );

		//Make sure the socket is an object type
		if ( typeof socket === "object" ) {

			//Set local value
			this.socket = socket;

			this.remoteAddress = socket._socket.remoteAddress;
			this.remotePort = socket._socket.remotePort;

			//Store the socket type without us having to do instanceof's
			if ( socket instanceof WebSocket ) this.type = "ws";
			// else if ( socket instanceof net.Socket ) this.type = "s";

			//Attach message/data events (ws/tcp, respectfully)
			this.socket.on( "message", data => this.receive( data ) );
			// this.socket.on( "data", data => this.receive( data ) );

			this.socket.on( "close", () => this.close() );

			//Attach error event
			this.socket.on( "error", data => this.error( data ) );

			//Output to console the new connection...
			this.log( "Connected" );

		}

	}

	//////////////////////////////////////////////
	//	Event handlers
	//////////////////////////////////////////////

	receive( data ) {

		if ( typeof data === "object" && data instanceof Buffer )
			data = data.toString();

		let packet;

		try {

			packet = JSON.parse( data );

		} catch ( err ) {

			return this.send( { id: "invalid", level: 0, account: this.account, host: this.host, data } );

		}

		this.log( "[RECV]" + colors.bmagenta, packet );

		//Packets come in as two categories (online and offline)
		if ( ! this.account )

			switch ( packet.id ) {

				case "login": return this.login( packet );
				case "register": return this.register( packet );
				default: return this.send( { id: "invalid", level: 1, account: this.account, host: this.host, data: packet } );

			}

		switch ( packet.id ) {

			//Account
			case "logout": return this.logout();

			//Communication
			case "broadcast": return this.broadcast( packet );
			case "echo": return this.echo( packet );
			case "whisper": return this.whisper( packet );

			//Groups
			case "claim": return this.claim();
			case "join": return this.join( packet.group );
			case "noGroup": return this.noGroup( packet );

			//Friends
			case "friendList": return this.friendList( packet );
			case "friendAdd": return this.friendAdd( packet );
			case "friendRemove": return this.friendRemove( packet );

			//Misc
			case "js": return this.js( packet.data );

			//Hosts
			case "reserve": return this.reserve( packet );
			case "bridge": return this.bridge( packet );
			case "roomList": return this.roomList( packet );
			case "hostList": return this.hostList();
			case "upgrade": return this.upgrade( packet );

			default: {

				if ( ! this.host ) return this.send( { id: "invalid", level: 2, account: this.account, host: this.host, data: packet } );

				switch ( packet.id ) {

					case "onBridge": return this.onBridge( packet );
					case "onRoom": return this.onRoom( packet );
					case "rejectRoom": return this.rejectRoom( packet );
					case "bridgeReject": return this.bridgeReject( packet );
					case "onReserve": return this.onReserve( packet );
					case "onReserveReject": return this.onReserveReject( packet );
					case "unlist": return this.unlist( packet );
					case "relist": return this.relist( packet );
					case "unreserve": return this.unreserve( packet );
					case "update": return this.update( packet );
					default: return this.send( { id: "invalid", level: 3, account: this.account, host: this.host, data: packet } );

				}

			}

		}

	}

	close() {

		this.log( "Disconnected" );

		//Tell friends they've logged off
		for ( let i = 0; i < this.friends.length; i ++ ) {

			const key = this.friends[ i ].account.toLowerCase();

			if ( this.friends[ i ].mutual && key in clients )
				clients[ key ].send( { id: "onWhisper", account: this.account, message: "Your friend " + this.account + " has logged off." } );

		}

		if ( this.group ) this.group.removeClient( this );

		// Unreserve any rooms client was host of
		for ( let i = 0; i < rooms.length; i ++ )

			if ( rooms[ i ].host === this ) {

				rooms[ i ].unreserve();
				i --;

			}

		clients.splice( clients.indexOf( this ), 1 );

		if ( this.account )
			setImmediate( () => delete clients[ this.account.toLowerCase() ] );

	}

	//////////////////////////////////////////////
	//	Authentication
	//////////////////////////////////////////////

	async login( packet ) {

		if ( ! packet.account ) packet.account = "anon";

		if ( packet.account.toLowerCase() !== "anon" && ( typeof packet.account !== "string" || typeof packet.password !== "string" ) )
			return this.send( { id: "onLoginFail", reasonCode: 2, reason: "Account or password not provided.", data: packet } );

		const user = ( await db.query( "SELECT id, CAST( password AS CHAR( 60 ) ) AS password, avatar FROM users WHERE name = ?;", packet.account ) )[ 0 ];

		if ( ! user ) return this.send( { id: "onLoginFail", reasonCode: 1, reason: "Provided account does not exist.", data: packet } );

		if ( packet.account.toLowerCase() !== "anon" && ! await bcrypt.compare( packet.password, user.password ) )
			return this.send( { id: "onLoginFail", reasonCode: 0, reason: "Provided password is incorrect.", data: packet } );

		this.originalAccount = packet.account;

		this.account = packet.account;
		while ( clients[ this.account ] )
			if ( this.account.indexOf( "#" ) >= 0 )
				this.account = this.account.slice( 0, this.account.indexOf( "#" ) + 1 ) + ( parseInt( this.account.slice( this.account.indexOf( "#" ) + 1 ) ) + 1 );
			else this.account = this.account + "#2";

		clients[ this.account ] = this;

		this.id = user.id;
		this.avatar = user.avatar || "";

		this.fetchFriends();

		this.send( { id: "onLogin", account: this.account } );

	}

	logout() {

		//Remove client from group
		if ( this.group ) this.group.removeClient( this );
		this.group = null;

		//Tell friends they've logged off
		for ( let i = 0; i < this.friends.length; i ++ ) {

			const key = this.friends[ i ].account.toLowerCase();

			if ( this.friends[ i ].mutual && key in clients )
				clients[ key ].send( { id: "onWhisper", account: this.account, message: "Your friend " + this.account + " has logged off." } );

		}

		// Remove from quick-access clients
		const account = this.account.toLowerCase();
		setImmediate( () => delete clients[ account ] );

		//Set account to null (logged out)
		const tempAccount = this.account;
		this.account = null;
		this.id = null;
		this.originalAccount = null;

		//Set mode to normal (so a next client doesn't have terminal access)
		this.mode = "normal";

		//Report it out
		this.send( { id: "onLogout", account: tempAccount } );

	}

	async register( packet ) {

		if ( typeof packet.account !== "string" || typeof packet.password !== "string" )
			return this.send( { id: "onRegisterFail", reasonCode: 5, reason: "Account or password not provided.", data: packet } );

		if ( ! /^[a-zA-z'][a-zA-z ']*[a-zA-Z']$/.test( packet.account ) || packet.account.length >= 32 )
			return this.send( { id: "onRegisterFail", reasonCode: 4, reason: "Provided account does not meet requirements.", data: packet } );

		if ( ( await db.query( "SELECT * FROM users WHERE name = ?;", packet.account ) )[ 0 ] )
			return this.send( { id: "onRegisterFail", reasonCode: 3, reason: "Provided account already exists.", data: packet } );

		await db.query( "INSERT INTO users ( name, password ) VALUES ( ?, ? );", [ packet.account, await bcrypt.hash( packet.password, 10 ) ] );

		this.send( { id: "onRegister", account: packet.account } );

	}

	//////////////////////////////////////////////
	//	Communcation
	//////////////////////////////////////////////

	whisper( packet ) {

		if ( typeof packet.account !== "string" || typeof packet.message !== "string" )
			return this.send( { id: "onWhisperFail", reasonCode: 7, reason: "Account not provided.", data: packet } );

		const target = clients[ packet.account.toLowerCase() ];

		if ( ! instance( target, Client ) )
			return this.send( { id: "onWhisperFail", reasonCode: 6, reason: "Provided account is not logged in.", data: packet } );

		this.send( { id: "onWhisperEcho", account: target.account, message: packet.message } );

		target.send( { id: "onWhisper", account: this.account, message: packet.message } );

	}

	echo( data ) {

		data.id = "onEcho";
		data.timestamp = Date.now();

		this.send( data );

	}

	broadcast( data ) {

		if ( ! this.group )
			return this.send( { id: "onBroadcastFail", reasonCode: 8, reason: "You are not in a group." } );

		data.id = "onBroadcast";
		data.timestamp = Date.now();

		this.group.send( data, this );

	}

	//////////////////////////////////////////////
	//	Groups
	//////////////////////////////////////////////

	join( group ) {

		if ( typeof group !== "string" )
			return this.send( { id: "onJoinFail", reasonCode: 9, reason: "Group not specified." } );

		this.setGroup( group );

	}

	noGroup( data ) {

		if ( typeof this.group !== "object" )
			return this.send( { id: "onNoGroupFail", reasonCode: 10, reason: "You are not in a group.", data } );

		this.group.removeClient( this );
		this.send( { id: "onNoGroup", data } );
		this.group = null;

	}

	// TODO: do logic
	// claim() {
	//
	// }

	//////////////////////////////////////////////
	//	Friends
	//////////////////////////////////////////////

	async fetchFriends() {

		if ( this.originalAccount.toLowerCase() === "anon" ) return;

		const query = [
			"SELECT name, IF( target.origin, 1, 0 ) AS mutual, avatar",
			"FROM ( SELECT * FROM friends WHERE origin = ? ) origin",
			"LEFT JOIN ( SELECT * FROM friends WHERE target = ? ) target ON origin.target = target.origin",
			"LEFT JOIN users ON origin.target = users.id;"
		].join( "\n" );

		this.friends = ( await db.query( query, [ this.id, this.id ] ) ).map( friend =>
			( { account: friend.name, avatar: friend.avatar || "", mutual: !! friend.mutual } ) );

		for ( let i = 0; i < this.friends.length; i ++ ) {

			if ( ! this.friends[ i ].mutual ) continue;

			const friend = clients[ this.friends[ i ].account.toLowerCase() ];

			if ( friend )
				friend.send( { id: "onWhisper", account: this.account, message: "Your friend " + this.account + " has logged on." } );

		}

	}

	friendList( data ) {

		if ( this.originalAccount.toLowerCase() === "anon" ) return;

		const friends = [];

		for ( let i = 0; i < this.friends.length; i ++ ) {

			const friend = {
				account: this.friends[ i ].account,
				avatar: this.friends[ i ].avatar,
				mutual: this.friends[ i ].mutual
			};

			const friendClient = clients[ this.friends[ i ].account.toLowerCase() ];
			if ( friend ) {

				friendClient.online = true;

				if ( friend.mutual ) friend.location = ( friendClient.group ? friendClient.group.name : "" );

			} else friend.online = false;

			friends.push( friend );

		}

		this.send( { id: "onFriendList", list: friends, data } );

	}

	async friendAdd( packet ) {

		if ( this.originalAccount.toLowerCase() === "anon" ) return;

		const target = ( await db.query( "SELECT id FROM users WHERE name = ?;", packet.account ) )[ 0 ];

		if ( ! target )
			return this.send( { id: "onFriendAddFail", reasonCode: 12, reason: "Provided account does not exist.", data: packet } );

		const added = await db.query( "INSERT INTO friends ( origin, target ) VALUES ( ?, ? );", [ this.id, target.id ] )
			.catch( err => {

				if ( err.code === "ER_DUP_ENTRY" )
					this.send( { id: "onFriendAddFail", reasonCode: 11, reason: "Provided account is already a friend." } );

				else this.error( err );

				return Promise.resolve( false );

			} );

		if ( ! added ) return;

		this.send( { id: "onFriendAdd", account: packet.account } );

		const query = [
			"SELECT name, IF( target.origin, 1, 0 ) AS mutual, avatar",
			"FROM ( SELECT * FROM friends WHERE origin = ? AND target = ? ) origin",
			"LEFT JOIN ( SELECT * FROM friends WHERE origin = ? AND target = ? ) target ON origin.target = target.origin",
			"LEFT JOIN users ON origin.target = users.id;"
		].join( "\n" );

		const friendship = ( await db.query( query, [ this.id, target.id, target.id, this.id ] ) )[ 0 ];

		this.friends.push( { account: friendship.name, avatar: friendship.avatar || "", mutual: !! friendship.mutual } );

		const addee = clients[ friendship.name.toLowerCase() ];
		if ( addee ) {

			const friendship = addee.friends.find( friend => friend.account === this.account );
			if ( friendship ) friendship.mutual = true;

		}

	}

	async friendRemove( packet ) {

		if ( this.originalAccount.toLowerCase() === "anon" ) return;

		const target = ( await db.query( "SELECT id FROM users WHERE name = ?;", packet.account ) )[ 0 ];

		if ( ! target )
			return this.send( { id: "onFriendRemoveFail", reasonCode: 14, reason: "Provided account does not exist.", data: packet } );

		if ( ( await db.query( "DELETE FROM friends WHERE origin = ? AND target = ?;", [ this.id, target.id ] ) ).affectedRows === 0 )
			return this.send( { id: "onFriendRemoveFail", reasonCode: 13, reason: "Provided account is not friends list." } );

		this.send( { id: "onFriendRemove", account: packet.account } );

		{

			const index = this.friends.findIndex( friend => friend.account.toLowerCase() === packet.account.toLowerCase() );
			if ( index >= 0 ) this.friends.splice( index, 1 );

		}

		const removee = clients[ packet.account.toLowerCase() ];
		if ( removee ) {

			const friendship = removee.friends.find( friend => friend.account === this.account );
			if ( friendship ) friendship.mutual = false;

		}

	}

	//////////////////////////////////////////////
	//	Hosts
	//////////////////////////////////////////////

	reserve( packet ) {

		if ( typeof packet.host !== "string" )
			return this.send( { id: "onReserveFail", reasonCode: 16, reason: "Account not provided.", data: packet } );

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onReserveFail", reasonCode: 65, reason: "Room name not provided.", data: packet } );

		const host = clients[ packet.host.toLowerCase() ];

		if ( ! host || ! host.host )
			return this.send( { id: "onReserveFail", reasonCode: 15, reason: "Provided account not logged in.", data: packet } );

		host.send( { id: "reserve", name: packet.name, owner: this.originalAccount } );

	}

	bridge( packet ) {

		if ( typeof packet.host !== "string" )
			return this.send( { id: "onBridgeFail", reasonCode: 18, reason: "Account not provided.", data: packet } );

		const host = clients[ packet.host.toLowerCase() ];

		if ( ! host || ! host.host )
			return this.send( { id: "onBridgeFail", reasonCode: 17, reason: "Provided account not logged in.", data: packet } );

		host.send( { id: "bridge", originalAccount: this.originalAccount, account: this.account, ip: this.getIp() } );

	}

	// Should add filter function
	roomList() {

		this.send( { id: "onRoomList", list: rooms.filter( room => room.listed ).map( room => ( {
			name: room.name,
			listed: room.listed,
			host: room.host.account,
			app: room.app,
			date: room.date,
			version: room.version,
			preview: room.preview

		} ) ).sort( ( a, b ) => a.listed - b.listed ) } );

	}

	hostList() {

		this.send( { id: "onHostList", list: clients.filter( client => client.host ).map( client => client.account ) } );

	}

	upgrade( packet ) {

		this.host = true;
		this.hostPort = packet.port;
		this.scheme = packet.scheme || "ws";
		this.send( { id: "onUpgrade" } );

	}

	onBridge( packet ) {

		if ( typeof packet.account !== "string" )
			return this.send( { id: "onOnBridgeFail", reasonCode: 20, reason: "Account not provided", data: packet } );

		const client = clients[ packet.account.toLowerCase() ];

		if ( ! client )
			return this.send( { id: "onOnBridgeFail", reasonCode: 19, reason: "Provided account not logged in.", data: packet } );

		client.send( { id: "onBridge", scheme: this.scheme, ip: this.getIp(), port: this.hostPort, key: packet.key, account: this.account } );
		this.send( { id: "onOnBridge", account: packet.account } );

	}

	bridgeReject( packet ) {

		if ( typeof packet.account !== "string" )
			return this.send( { id: "onBridgeRejectFail", reasonCode: 23, reason: "Account not provided.", data: packet } );

		const client = clients[ packet.account.toLowerCase() ];

		if ( ! client )
			return this.send( { id: "onBridgeRejectFail", reasonCode: 22, reason: "Provided account not logged in.", data: packet } );

		client.send( { id: "onBridgeFail", reasonCode: 21, reason: packet.reason } );
		this.send( { id: "onOnBridgeReject", account: packet.account } );

	}

	onRoom( packet ) {

		if ( typeof packet.account !== "string" )
			return this.send( { id: "ononRoomFail", reasonCode: 25, reason: "Account not provided.", data: packet } );

		const client = clients[ packet.account.toLowerCase() ];

		if ( ! client )
			return this.send( { id: "ononRoomFail", reasonCode: 24, reason: "Provided account not logged in.", data: packet } );

		client.send( { id: "onRoom", room: packet.room, scheme: this.scheme, host: this.account, ip: this.getIp(), port: this.hostPort, key: packet.key } );
		this.send( { id: "ononRoom", account: packet.account } );

	}

	rejectRoom( packet ) {

		if ( typeof packet.account !== "string" )
			return this.send( { id: "onRejectRoomFail", reasonCode: 28, reason: "Account not provided.", data: packet } );

		const client = clients[ packet.host.toLowerCase() ];

		if ( ! client )
			return this.send( { id: "onRejectRoomFail", reasonCode: 27, reason: "Provided account not logged in.", data: packet } );

		client.send( { id: "onRoomFail", room: packet.data.room, host: this.account, reasonCode: 26, reason: packet.reason, data: packet.data } );
		this.send( { id: "onRejectRoom", data: packet } );

	}

	onReserve( packet ) {

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onRejectRoomFail", reasonCode: 28, reason: "Account not provided.", data: packet } );

		if ( rooms.dict[ packet.name.toLowerCase() ] )
			return this.send( { id: "onOnReserveFail", reasonCode: 29, reason: "Provided room already exists.", data: packet } );

		new Room( packet.name, this );

		for ( let i = 0; i < clients.length; i ++ )
			if ( clients[ i ] === this )
				clients[ i ].send( { id: "onOnReserve", name: packet.name, host: this.account, owner: packet.owner } );
			else
				clients[ i ].send( { id: "onReserve", name: packet.name, host: this.account, owner: packet.owner } );

	}

	onReserveReject( packet ) {

		if ( typeof packet.owner !== "string" )
			return this.send( { id: "onReserveRejectFail", reasonCode: 66, reason: "Owner not provided.", data: packet } );

		if ( typeof packet.room !== "string" )
			return this.send( { id: "onReserveRejectFail", reasonCode: 67, reason: "Room not provided.", data: packet } );

		const owner = clients[ packet.owner.toLowerCase() ];

		if ( ! owner )
			return this.send( { id: "ononRoomFail", reasonCode: 68, reason: "Provided owner not logged in.", data: packet } );

		if ( owner !== this )
			owner.send( { id: "onReserveReject", room: packet.room, host: this.owner, reason: packet.reason } );

		this.send( { id: "onOnReserveReject", room: packet.room, owner: packet.owner } );

	}

	unlist( packet ) {

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onUnlistFail", reasonCode: 33, reason: "Room not provided.", data: packet } );

		const room = rooms.dict[ packet.name.toLowerCase() ];

		if ( ! room )
			return this.send( { id: "onUnlistFail", reasonCode: 32, reason: "Provided room does not exist.", data: packet } );

		if ( room.host !== this )
			return this.send( { id: "onUnlistFail", reasonCode: 31, reason: "You are not the host of provided room.", data: packet } );

		room.unlist();
		this.send( { id: "onUnlist", name: packet.name } );

	}

	relist( packet ) {

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onRelistFail", reasonCode: 37, reason: "Room not provided.", data: packet } );

		const room = rooms.dict[ packet.name.toLowerCase() ];

		if ( ! room )
			return this.send( { id: "onRelistFail", reasonCode: 36, reason: "Provided room does not exist.", data: packet } );

		if ( room.host !== this )
			return this.send( { id: "onRelistFail", reasonCode: 35, reason: "You are not the host of provided room.", data: packet } );

		if ( room.listed )
			return this.send( { id: "onRelistFail", reasonCode: 34, reason: "Provided room is already listed.", data: packet } );

		room.unlist();
		this.send( { id: "onRelist", name: packet.name } );

	}

	unreserve( packet ) {

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onUnreserveFail", reasonCode: 40, reason: "Room not provided.", data: packet } );

		const room = rooms.dict[ packet.name.toLowerCase() ];

		if ( ! room )
			return this.send( { id: "onUnreserveFail", reasonCode: 39, reason: "Provided room does not exist.", data: packet } );

		if ( room.host !== this )
			return this.send( { id: "onUnreserveFail", reasonCode: 38, reason: "You are not the host of provided room.", data: packet } );

		for ( let i = 0; i < clients.length; i ++ )
			clients[ i ].send( { id: "onUnreserve", name: room.name, host: this.account } );

		room.unreserve();

	}

	update( packet ) {

		if ( typeof packet.name !== "string" )
			return this.send( { id: "onUpdateFail", reasonCode: 43, reason: "Room not provided.", data: packet } );

		const room = rooms.dict[ packet.name.toLowerCase() ];

		if ( ! room )
			return this.send( { id: "onUpdateFail", reasonCode: 42, reason: "Provided room does not exist.", data: packet } );

		if ( room.host !== this )
			return this.send( { id: "onUpdateFail", reasonCode: 41, reason: "You are not the host of provided room.", data: packet } );

		if ( typeof packet.app !== "undefined" )
			room.app = packet.app;

		if ( typeof packet.date !== "undefined" )
			room.date = packet.date;

		if ( typeof packet.version !== "undefined" )
			room.version = packet.version;

		if ( typeof packet.preview !== "undefined" )
			room.preview = packet.preview;

		const onUpdateData = {
			id: "onUpdate",
			name: packet.name,
			app: room.app,
			date: room.date,
			version: room.version,
			preview: room.preview
		};

		for ( let i = 0; i < clients.length; i ++ )
			clients[ i ].send( onUpdateData );

	}

	//////////////////////////////////////////////
	//	Misc
	//////////////////////////////////////////////

	js( data ) {

		if ( this.mode !== "js" ) this.send( { id: "onJSFail", reasonCode: 44, reason: "JavaScript mode not enabled." } );

		try {

			this.send( eval( data ), true );

		} catch ( err ) {

			this.send( err, true );

		}

	}

	//////////////////////////////////////////////
	//	Secondary Support Functions
	//////////////////////////////////////////////

	address( arr ) {

		const address = this.type === "ws" ?
			[ this.remoteAddress, this.remotePort ] :
			[ this.remoteAddress, this.remotePort ];

		//Return value
		if ( arr === true ) return address;
		else return address.join( ":" );

	}

	getIp() {

		const addr = this.address( true );

		if ( addr[ 0 ].indexOf( "192.168" >= 0 ) ) return "notextures.io";
		else return addr;

	}

	setGroup( group ) {

		if ( typeof group === "string" )
			group = groups[ group.toLowerCase() ] || new Group( group );

		if ( group.canJoin( this ) ) {

			//Remove them from any present group
			// TODO: This should only be null or undefined - pick one
			if ( this.group !== null && this.group !== undefined ) this.group.removeClient( this );

			//Set local group variable
			this.group = group;

			//Tell the group to add the client
			group.addClient( this );

		} else {

			if ( group.clients.length === 0 ) group.destroy();

			this.send( { id: "onJoinFail", reasonCode: 45, reason: "Unable to join provided group." } );

		}

	}

	//////////////////////////////////////////////
	//	Primary Support Functions
	//////////////////////////////////////////////

	error( ...args ) {

		console.error( dateformat( new Date(), "hh:MM:sst" ) + colors.blue, this.account || this.address(), ...args, colors.default );

	}

	log( ...args ) {

		console.log( dateformat( new Date(), "hh:MM:sst" ) + colors.bblue, this.account || this.address(), ...args, colors.default );

	}

	send( data, useUtil ) {

		//Only try to send if client socket is receiving
		if ( ! ( this.socket.readyState === 1 || this.socket.readyState === "open" ) ) return;

		try {

			const s = useUtil ?
				util.inspect( data ) :
				JSON.stringify( data );

			if ( s.length > 5000 ) return;

			this.log( "[SEND]" + colors.green, data );

			//Send via websocket
			if ( this.type === "ws" ) this.socket.send( s );

			//Send via socket
			else if ( this.type === "s" ) this.socket.write( s );

		} catch ( e ) { /* do nothing */ }

	}

}

Client.instances = clients;
