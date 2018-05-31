
import dateformat from "dateformat";

import UTIL from "./util";

const groups = [];

export default class Group {

	constructor( name ) {

		//Define local variables
		this.name = name;
		this.clients = [];
		this.history = [];
		this.settings = { permissions: {}, ranks: {} };

		//Load settings if they exist
		//this.pickupSettings(callback);
		// callback( this );

		//Log it
		this.log( "Reserved group" );

	}

	destroy() {

		for ( let i = 0; i < this.clients; i ++ )
			this.removeClient( this.clients[ i ] );

		groups.splice( groups.indexOf( this ), 1 );

		const name = this.name.toLowerCase();
		setImmediate( () => delete groups[ name ] );

		this.log( "Group unreserved" );

	}

	canJoin( client ) {

		while ( this.loadingSettings ) {}

		//Unclaimed
		if ( typeof this.settings.permissions.join === "undefined" ||

				//Anyone can join
				this.settings.permissions.join == 0 ||

				//If client meets the class requirement
				( client.groups[ this.name ] && this.settings.permissions.join >= client.groups[ this.name ].class ) )

			return true;

		return false;

	}

	//////////////////////////////////////////////
	//	Client handling
	//////////////////////////////////////////////

	addClient( client ) {

		//Tell our clients who are already here
		this.send( { id: "onJoin", group: this.name, accounts: [ { account: client.account, avatar: client.avatar } ] } );

		//So we can loop through clients...
		this.clients.push( client );

		//For easy access of clients...
		this.clients[ client.account ] = client;

		var accounts = [];
		for ( var i = 0; i < this.clients.length; i ++ )
			accounts.push( { account: this.clients[ i ].account, avatar: this.clients[ i ].avatar } );

		//Tell the client who's here
		client.send( { id: "onGroup", group: this.name, accounts: accounts } );

		//Log it
		this.log( "Added user", client.account );

	}

	removeClient( client ) {

		//Remove them from simple array list
		this.clients.splice( this.clients.indexOf( client ), 1 );
		//delete this.clients[this.clients.indexOf(client)];

		//Remove them from specific account list
		const account = client.account.toLowerCase();
		setImmediate( () => delete this.clients[ account ] );

		//Tell our clients
		this.send( { id: "onLeave", group: this.name }, client );

		//Log it
		this.log( "Removed user", client.account );
		//this.history.push([Date.now(), client, 'r']);

		//Remove Group if empty
		if ( this.clients.length == 0 ) this.destroy();

	}

	//////////////////////////////////////////////
	//	Group communication
	//////////////////////////////////////////////

	send( data, account ) {

		//Append a group name to the packet
		//	This makes data.group effectively reserved for any data transmitting through this function
		data.group = this.name;

		//Only allows data.account to be set if an account is passed, otherwise kill it
		if ( account ) data.account = account.account;
		else delete data.account;

		//Loop through clients in group
		for ( let i = 0; i < this.clients.length; i ++ ) {

			//Send via client
			this.clients[ i ].send( data );

		}

		//Log it
		//this.history.push([Date.now(), this, account, 's', data]);

	}

	//////////////////////////////////////////////
	//	Misc
	//////////////////////////////////////////////

	log( ...args ) {

		console.log( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.bred, this.name, ...args, UTIL.colors.default );

	}

}

Group.instances = groups;
