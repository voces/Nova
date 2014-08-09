//////////////////////////////////////////////
//	Constructor + property set/gets
//////////////////////////////////////////////

//Client class
//	socket	The socket of the client, can either be WebSocket or net.Socket
function Client(socket) {
	
	this.account;
	this.id;
	this.mode = "normal";
	this.host = false;
	this.group = null;
	this.friends = [];
	
	//Make sure the socket is an object type
	if (typeof socket == "object") {
		
		//Set local value
		this.socket = socket;
		
		//Store the socket type without us having to do instanceof's
		if (socket instanceof WebSocket) this.type = "ws";
		else if (socket instanceof net.Socket) this.type = "s";
		
		//Attach message/data events (ws/tcp, respectfully)
		this.socket.on('message', this.receive.bind(this));
		this.socket.on('data', this.receive.bind(this));
		
		this.socket.on('close', this.close.bind(this));
		
		//Attach error event
		this.socket.on('error', this.error.bind(this));
		
		//Output to console the new connection...
		this.log('Connected');
		
	//Else just give up
	} else return;
}

//////////////////////////////////////////////
//	Event Managers
//////////////////////////////////////////////

Client.prototype.receive = function(data) {
	
	//Check if the incoming data is as a Buffer
	if (typeof data == "object" && data instanceof Buffer) {
		
		//It is, so convert to string
		data = data.toString();
		
		//Remove last bit... this should actually be handled client-side, but nc sends shitty stuff
		//data = data.substr(0, data.length-1);
	}
	
	try {
		
		//Try to convert the text into JSON
		var packet = JSON.parse(data);
		
		//Report it out first
		this.log(cc.magenta, packet);
		
	//Incoming object isn't in JSON format
	} catch (err) {
		
		//If the mode is set to JS, treat it as REPL...
		//if (this.mode == "js") var packet = {id:"js", command:data};
		
		//If they simply sent "koalas", it's a keyword and direct JS control is enabled
		/*else if (data == "koalas") {
			this.mode = "js";
			this.send("Access Granted", true);
			return;
		
		//Packet is definitely invalid of some sort, so tell client
		} else*/ this.send({id:"invalid", level:0, account: this.account, host:this.host, data:data});
	};
	
	if (packet) {
		
		//Packets come in as two categories (online and offline)
		if (!this.account) {
			
			//Account
			if (packet.id == "login") this.login(packet);
			else if (packet.id == "register") this.register(packet);
			
			//Misc
			//else if (packet.id == "js") this.js(packet.data);
			
			//Missing packet
			else this.send({id:"invalid", level:1, account: this.account, host:this.host, data:packet});
			
		} else {
			
			//Account
			if (packet.id == "logout") this.logout();
			
			//Communication
			else if (packet.id == "broadcast") this.broadcast(packet);
			else if (packet.id == "echo") this.echo(packet);
			else if (packet.id == "whisper") this.whisper(packet);
			
			//Groups
			//else if (packet.id == "claim") this.claim();
			else if (packet.id == "join") this.join(packet.group);
			else if (packet.id == "noGroup") this.noGroup(packet);
			
			//Friends
			else if (packet.id == "friendList") this.friendList(packet);
			else if (packet.id == "friendAdd") this.friendAdd(packet);
			else if (packet.id == "friendRemove") this.friendRemove(packet);
			
			//Misc
			//else if (packet.id == "js") this.js(packet.data);
			
			//Hosts
			else if (packet.id == "reserve") this.reserve(packet);
			else if (packet.id == "bridge") this.bridge(packet);
			else if (packet.id == "lobbyList") this.lobbyList();
			else if (packet.id == "hostList") this.hostList();
			else if (packet.id == "upgrade") this.upgrade(packet);
			
			else if (this.host == true) {
				
				if (packet.id == "onBridge") this.onBridge(packet);
				else if (packet.id == "onLobby") this.onLobby(packet);
				else if (packet.id == "rejectLobby") this.rejectLobby(packet);
				else if (packet.id == "bridgeReject") this.bridgeReject(packet);
				else if (packet.id == "onReserve") this.onReserve(packet);
				else if (packet.id == "unlist") this.unlist(packet);
				else if (packet.id == "relist") this.relist(packet);
				else if (packet.id == "unreserve") this.unreserve(packet);
				else if (packet.id == "update") this.update(packet);
				
				//Invalid packet
				else this.send({id:"invalid", level:3, account: this.account, host:this.host, data:packet});
			} else this.send({id:"invalid", level:2, account: this.account, host:this.host, data:packet});
		}
	}
}

Client.prototype.close = function() {
	this.log('Disconnected');
	
	if (this.group) this.group.removeClient(this);
	
	for (var i = 0; i < lobbies.length; i++) {
		if (lobbies[i].host == this) {
			lobbies[i].unreserve();
			i--;
		}
	}
	
	server.removeClient(this);
}

//////////////////////////////////////////////
//	Logging in/out
//////////////////////////////////////////////

//Logs the client in with a specific account
//	account		String, the account of the client
//	password	String, the password of the client
Client.prototype.login = function(packet) {
	
	if (packet.account == '') packet.account = 'anon';
	
	//Verify account and password are strings
	if (typeof packet.account == "string" && typeof packet.password == "string") {
		
		//Do query and apply handlers
		db.query("select * from users where name = ?", packet.account, function(err, rows, fields) {
			
			//Errors really shouldn't occur, so throw them and crash the server? Bad idea, w/e.
			if (err) this.error(err);
			
			//Check if we have a result
			if (rows.length) {
				
				//Compare the guess to stored hash
				bcrypt.compare(packet.password, rows[0].password, function(err, res) {
					
					//Is a match
					if (res === true) {
						
						//Original account is a non-numbered account (the true username)
						this.originalAccount = packet.account;
						
						//Append number tag if someone already in with account
						while (clients[packet.account.toLowerCase()]) {
							if (packet.account.indexOf("#") >= 0)
								packet.account = packet.account.substr(0, packet.account.indexOf("#") + 1) + (parseInt(packet.account.substr(packet.account.indexOf("#") + 1)) + 1);
							else packet.account = packet.account + "#2";
						}
						
						//Set account name
						this.account = packet.account;
						
						//Set properties from DB
						this.id = rows[0].id;								//id (row in users table)
						this.avatar = rows[0].avatar ? rows[0].avatar : "";	//avatar
						
						//Fetch friends
						this.fetchFriends();
						
						//Modify the server clients array for easy access
						clients[this.account.toLowerCase()] = this;
						
						//Tell them they are successful
						this.send({id: 'onLogin', account: this.account});
						
						//Upgrade lastlogged
						db.query("update users set lastlogged = now() where name = ?", this.originalAccount);
						
					//Invalid password, tell them so
					} else this.send({id: 'onLoginFail', reason: 'password', data: packet});
					
				}.bind(this));

			//We don't so return invalid account
			} else this.send({id: 'onLoginFail', reason: 'account', data: packet});
			
		}.bind(this));
		
	//Account or password improper type/not set
	} else this.send({id: 'onLoginFail', reason: 'args', data: packet});
}

//Logs the client out
Client.prototype.logout = function() {
	
	//Remove client from group
	if (this.group) this.group.removeClient(this);
	
	//Set account to null (logged out)
	var tempAccount = this.account;
	delete clients[this.account.toLowerCase()];
	this.account = null;
	this.id = null;
	this.originalAccount = null;
	
	//Set mode to normal (so a next client doesn't have terminal access)
	this.mode = "normal";
	
	//Report it out
	this.send({id: 'onLogout', account: tempAccount});
	
}

//Registers an account with a password
//	account		String, the account of the client
//	passsword	String, the password of the client
Client.prototype.register = function(packet) {
	
	//Verify account and password are strings
	if (typeof packet.account == "string" && typeof packet.password == "string") {
		
		//Validate account name
		if (/^[a-zA-z'][a-zA-z ']*[a-zA-Z']$/.test(packet.account) && packet.account.length < 32) {
			
			//Do query and apply handlers
			//	Oddly enough, the escape function automatically encloses the string
			db.query("select * from users where name = ?", packet.account, function(err, rows, fields) {
				
				//Errors really shouldn't occur, so throw them and crash the server? Bad idea, w/e.
				if (err) this.error(err);
				
				//Make sure the account doesn't exist
				if (!rows.length) {
					
					//Generate a salt
					bcrypt.genSalt(10, function(err, salt) {
						
						//Hash it
						bcrypt.hash(packet.password, salt, function(err, hash) {
							this.log('HASH: ', hash);
							//Store it
							db.query("insert into users (name, password) values (?, ?)", [packet.account, hash], function(err, rows, fields) {
								
								//Again, errors shouldn't be occuring
								if (err) this.error(err);
								
								//Check if any rows were inserted
								if (rows.affectedRows == 1) {
									
									//Return positive result
									this.send({id: 'onRegister', account: packet.account});
									
								//No rows inserted, throw the error
								} else this.error(new Error('no rows affected'));
								
							}.bind(this));
							
						}.bind(this));
					}.bind(this));
					
				//Account already exists
				} else this.send({id: 'onRegisterFail', reason: 'duplicate', data: packet});
				
			}.bind(this));
		
		//Account name is not valid
		} else this.send({id: 'onRegisterFail', reason: 'invalid', data: packet});
		
	//Account or password improper type/not set
	} else this.send({id: 'onRegisterFail', reason: 'args', data: packet});
}

//////////////////////////////////////////////
//	Communcation
//////////////////////////////////////////////

Client.prototype.whisper = function(packet) {
	
	//Verify account and message are strings
	if (typeof packet.account == "string" && typeof packet.message == "string") {
		
		//Verify account is logged in
		if (instance(clients[packet.account.toLowerCase()], Client)) {
			
			//Echo the send
			this.send({id: 'onWhisperEcho', account: clients[packet.account.toLowerCase()].account, message: packet.message});
			
			//Send whisper
			clients[packet.account.toLowerCase()].send({id: 'onWhisper', account: this.account, message: packet.message});
			
		//User not logged in
		} else this.send({id: 'onWhisperFail', reason: 'notlogged', data: packet});
		
	//Account or message improper type/not set
	} else this.send({id: 'onWhisperFail', reason: 'args', data: packet});
}

Client.prototype.echo = function(data) {
	
	//Modify data
	data.id = 'onEcho';
	data.timestamp = new Date().getTime();
	
	//Send to client
	this.send(data);
}

Client.prototype.broadcast = function(data) {

	//If they are in a group
	if (this.group) {
		
		//Modify data
		data.id = 'onBroadcast';
		data.timestamp = new Date().getTime();
		
		//Broadcast to group
		this.group.send(data, this);
	
	//Else give them a fail
	} else this.send({id: 'onBroadcastFail', reason: 'no group'});
}

//////////////////////////////////////////////
//	Groups
//////////////////////////////////////////////

Client.prototype.join = function(group) {
	
	//Verify group is string
	if (typeof group == "string") {
		
		//Join the group
		this.setGroup(group);
	
	//Group isn't string
	} else this.send({id: 'onJoinFail', reason: 'args'});
		
}

Client.prototype.noGroup = function(data) {
	
	//Remove them from any present group
	if (typeof this.group == "object") {
		this.group.removeClient(this);
		this.send({id: 'onNoGroup', data: data});
		this.group = null;
	} else this.send({id: 'onNoGroupFail', reason: 'no group', data: data});
	
}

//	TODO: Completely redo how groups work
//	SEE: https://github.com/voces/webcraft/issues/1
/*Client.prototype.claim = function() {
	return;	//claiming currently disabled
	//If they are in a group
	if (this.group) {
		
		async.waterfall([
			
			//This section checks if user already is in some group
			function(callback) {
				var query = "select * from registry where userid = (select id from users where name = ?)";
				var args = this.originalAccount;
				
				db.query(query, args, function(err, rows, fields) {
					callback(err, rows.length > 0);
				}.bind(this));
			}.bind(this),
			
			//This section checks if the group is already claimed
			function(monopoly, callback) {
				if (!monopoly) {
					var query = "select * from groups where title = ?";
					var args = this.group.name;
					
					db.query(query, args, function(err, rows, fields) {
						callback(err, rows.length > 0);
					});
				} else callback({id: 'onClaimFail', reason: 'monopoly'});
			}.bind(this),
			
			//This section databases the group
			function(claimed, callback) {
				if (!claimed) {
					var query = "insert into groups (title) values (?)";
					var args = this.group.name;
					
					db.query(query, args, function(err, rows, fields) {
						callback(err, rows.insertId);
					});
				} else callback({id: 'onClaimFail', reason: 'claimed'});
			}.bind(this),
			
			//This section databases ranks
			function(groupid, callback) {
				var query = "insert into ranks (groupid, class, title) values (?, 1, 'Leader'), (?, 2, 'Deputy'), (?, 3, 'Officer'), (?, 4, 'Citizen')";
				var args = [groupid, groupid, groupid, groupid];
				
				db.query(query, args, function(err, rows, fields) {
					callback(err, groupid, rows.insertId);
				});
			},
			
			//This section databases permissions and registers the user
			function(groupid, rankId, callback) {
				
				//Going to do two operations in parallel...
				async.parallel([
					
					//This subsection registers the user
					function(callback) {
						var query = "insert into registry (userid, groupid, rankid) values ((select id from users where name = ?), ?, ?)";
						var args = [this.originalAccount, groupid, rankId];
						
						db.query(query, args, function(err) {
							callback(err);
						});
					}.bind(this),
					
					//This subsection databases permissions
					function(callback) {
						var query = "insert into permissions (groupid, permission, minClass) values " +
								"(?, 'changePermission', 1)," +
								"(?, 'changeRank', 1)," +
								"(?, 'changePermissionBelow', 2)," +
								"(?, 'changeRankBelow', 2)," +
								"(?, 'ban', 3)," +
								"(?, 'squelch', 3)," +
								"(?, 'invite', 4)," +
								"(?, 'broadcast', 0)," +
								"(?, 'join', 0);";
						
						var args = [groupid, groupid, groupid, groupid, groupid, groupid, groupid, groupid, groupid];
						
						db.query(query, args, function(err) {
							this.groups[this.group.name] = {position: 'Leader', class: 1};
							callback(err);
						});
					}
				], function(err) {
					callback(err, {id: 'onClaim'});
				});
			}.bind(this)
		], function(err, result) {
			if (!err) this.group.pickupSettings();
			this.send(err || result);
		}.bind(this));
		
	//Else give them a fail
	} else this.send({id: 'onClaimFail', reason: 'group'});
}*/

//////////////////////////////////////////////
//	Friends
//////////////////////////////////////////////

Client.prototype.fetchFriends = function() {
	
	//Block friends related actions from anon account
	if (this.originalAccount.toLowerCase() == "anon") return;
	
	var query = "select name, if (target.origin, 1, 0) mutual, avatar from " + 
			"(select * from friends where origin = ?) origin left join " +
			"(select * from friends where target = ?) target on origin.target = target.origin join " + 
		"users on origin.target = users.id";
	
	//Do query and apply handlers
	db.query(query, [this.id, this.id], function(err, rows, fields) {
		
		//Errors really shouldn't occur, so throw them and crash the server? Bad idea, w/e.
		if (err) this.error(err);
		
		this.friends = [];
		
		//Append friends...
		for (var i = 0; i < rows.length; i++)
			this.friends.push({account: rows[i].name, avatar: rows[i].avatar || "", mutual: rows[i].mutual ? true : false});
		
		//Tell friends
		for (var i = 0; i < this.friends.length; i++) {
			var key = this.friends[i].account.toLowerCase();
			
			if (this.friends[i].mutual && key in clients)
				clients[key].send({id: 'onWhisper', account: this.account, message: "Your friend " + this.account + " has logged on."});
		}
		
	}.bind(this));
	
};

Client.prototype.friendList = function(data) {
	
	//Block friends related actions from anon account
	if (this.originalAccount.toLowerCase() == "anon") return;
	
	var friends = [];
	var friend;
	var key;
	
	for (var i = 0; i < this.friends.length; i++) {
		friend = {
			account: this.friends[i].account,
			avatar: this.friends[i].avatar,
			mutual: this.friends[i].mutual
		};
		
		var key = friend.account.toLowerCase();
		
		if (key in clients) {
			friend.online = true;
			
			if (friend.mutual) friend.location = (clients[key].group ? clients[key].group.name : "");
			
		} else friend.online = false;
		
		friends.push(friend);
	}
	
	this.send({id: 'onFriendList', list: friends, data: data});
	
};

Client.prototype.friendAdd = function(packet) {
	
	//Block friends related actions from anon account
	if (this.originalAccount.toLowerCase() == "anon") return;
	
	var query = "select id from users where name = ?";
	
	//Select id of person we are trying to add
	db.query(query, packet.account, function(err, rows, fields) {
		
		//Errors really shouldn't occur, so throw them and crash the server? Bad idea, w/e.
		if (err) {
			this.error(err);
			return;
		}
		
		//Check if we have an account
		if (rows.length == 1) {
			
			var query = "insert into friends (origin, target) values (?, ?)";
			
			//Try to insert the friend
			db.query(query, [this.id, rows[0].id], function(err, rows2, fields) {
				
				//An error occurred!
				if (err) {
					
					//They are already added
					if (err.code == 'ER_DUP_ENTRY') this.send({id: 'onFriendAddFail', reason: 'duplicate'});
					
					//something else
					else this.error(err);
				
				//Success
				} else {
					
					//Prepare directed and redirected friendship record
					var query = "select name, if (target.origin, 1, 0) mutual, avatar from " + 
						"(select * from friends where origin = ? and target = ?) origin left join " +
						"(select * from friends where origin = ? and target = ?) target on origin.target = target.origin join " + 
					"users on origin.target = users.id";
					
					//Grab friendship record (directed and redirected)
					db.query(query, [this.id, rows[0].id, rows[0].id, this.id], function(err, rows3, fields) {
						
						if (err) this.error(err);
						
						//Append friend to local list
						this.friends.push({account: rows3[0].name, avatar: rows3[0].avatar || "", mutual: rows3[0].mutual ? true : false});
						
						//Check if they are a new mutual friend, if they are, update mutual friend's local list
						var addee = clients[rows3[0].name.toLowerCase()];
						if (addee != null)
							for (var i = 0; i < addee.friends.length; i++)
								if (addee.friends[i].account == this.account) {
									addee.friends[i].mutual = true;
									break;
								}
						
					}.bind(this));
					
					//Report back
					this.send({id: 'onFriendAdd', account: packet.account});
				}
				
			}.bind(this));
			
		} else this.send({id: 'onFriendAddFail', reason: 'account', data: packet});
		
	}.bind(this));
};

Client.prototype.friendRemove = function(packet) {
	
	//Block friends related actions from anon account
	if (this.originalAccount.toLowerCase() == "anon") return;
	
	var query = "select id from users where name = ?";
	
	//Select id of person we are trying to remove
	db.query(query, packet.account, function(err, rows, fields) {
		
		//Errors really shouldn't occur, so throw them and crash the server? Bad idea, w/e.
		if (err) this.error(err);
		
		//Check if we have an account
		if (rows.length == 1) {
			
			var query = "delete from friends where origin = ? and target = ?";
			
			//Try to insert the friend
			db.query(query, [this.id, rows[0].id], function(err, rows2, fields) {
				
				//An error occurred!
				if (err) this.error(err);
				
				//They weren't even added
				else if (rows2.affectedRows == 0) this.send({id: 'onFriendRemoveFail', reason: 'not friend'});
				
				//Success
				else {
					
					//Remove friend from local list
					for (var i = 0; i < this.friends.length; i++)
						if (this.friends[i].account.toLowerCase() == packet.account) {
							this.friends.splice(i, 1);
							break;
						}
					
					//Remove mutual status if it exists
					var removee = clients[packet.account.toLowerCase()];
					
					if (removee != null)
						for (var i = 0; i < removee.friends.length; i++) {
							if (removee.friends[i].account == this.account) {
								removee.friends[i].mutual = false;
								break;
							}
						}
					
					this.send({id: 'onFriendRemove', account: packet.account});
				}
				
			}.bind(this));
			
		} else this.send({id: 'onFriendRemoveFail', reason: 'account', data: packet});
		
	}.bind(this));
};

//////////////////////////////////////////////
//	Hosts
//////////////////////////////////////////////

Client.prototype.reserve = function(packet) {
	
	var host = clients[packet.host];
	
	if (host && host.host) host.send({id: 'reserve', name: packet.name, owner: this.originalAccount});
	else this.send({id: 'onHostFail', reason: 'invalid host', data: packet});
	
}

Client.prototype.bridge = function(packet) {
	
	//Validate host argument
	if (typeof packet.host == "string") {
		
		//Validate user exists and is a host
		var host = clients[packet.host.toLowerCase()];
		
		if (host && host.host === true)
			host.send({id: 'bridge', originalAccount: this.originalAccount, account: this.account, ip: this.getIP()});
		else this.send({id: 'onBridgeFail', reason: 'invalid host', data: packet});
	} else this.send({id: 'onBridgeFail', reason: 'args', data: packet});
	
};

Client.prototype.lobbyList = function() {
	var lobbyList = [];
	
	for (var i = 0; i < lobbies.length; i++)
		if (lobbies[i].listed)
			lobbyList.push({
				name: lobbies[i].name,
				listed: lobbies[i].listed.getTime(),
				host: lobbies[i].host.account,
				protocol: lobbies[i].protocol,
				date: lobbies[i].date,
				version: lobbies[i].version,
				preview: lobbies[i].preview
			});
	
	lobbyList.sort(function(a, b) {return a.listed - b.listed;});
	
	this.send({id: 'onLobbyList', list: lobbyList});
}

Client.prototype.hostList = function() {
	var hostList = [];
	
	for (var i = 0; i < clients.length; i++)
		if (clients[i].host) hostList.push(clients[i].account);
	
	this.send({id: 'onHostList', list: hostList});
}

Client.prototype.upgrade = function(packet) {
	
	this.host = true;
	this.hostport = packet.port;
	this.send({id: 'onUpgrade'});
	
}

Client.prototype.onBridge = function(packet) {
	
	var client = clients[packet.account.toLowerCase()];
	
	if (client) {
		
		client.send({id: 'onBridge', ip: this.getIP(), port: this.hostport, key: packet.key, account: this.account});
		this.send({id: 'onOnBridge', account: packet.account});
		
	} else this.send({id: 'onOnBridgeFail', reason: 'invalid account', data: packet});
	
}

Client.prototype.bridgeReject = function(packet) {
	
	//Validate account argument
	if (typeof packet.account == "string") {
		
		//Validate client exists
		var client = clients[packet.account.toLowerCase()];
		
		if (typeof client != "undefined") {
			
			client.send({id: 'onBridgeFail', ip: this.getIP(), port: this.hostport, reason: packet.reason});
			this.send({id: 'onOnBridgeReject', account: packet.account});
			
		} else this.send({id: 'onBridgeRejectFail', reason: 'badAccount', data: packet});
	} else this.send({id: 'onBridgeRejectFail', reason: 'args', data: packet});
}

Client.prototype.onLobby = function(packet) {
	
	var client = clients[packet.account.toLowerCase()];
	
	if (client) {
		
		client.send({id: 'onLobby', lobby: packet.lobby, host: this.account, ip: this.getIP(), port: this.hostport, key: packet.key});
		this.send({id: 'onOnLobby', account: packet.account});
		
	} else this.send({id: 'onOnLobbyFail', reason: 'invalid account', data: packet});
};

Client.prototype.rejectLobby = function(packet) {
	
	var client = clients[packet.data.account.toLowerCase()];
	
	if (client) {
		
		client.send({id: 'onLobbyFail', lobby: packet.data.lobby, host: this.account});
		this.send({id: 'onRejectLobby', data: packet});
		
	} else this.send({id: 'onRejectLobbyFail', reason: 'invalid account'});
	
};

Client.prototype.onReserve = function(packet) {
	
	if (typeof packet.name == 'string') {
		if (typeof lobbies[packet.name.toLowerCase()] == 'undefined') {
			
			//Create the lobby
			new Lobby(packet.name, this);
			
			for (var i = 0; i < clients.length; i++) {
				if (clients[i] == this)
					clients[i].send({id: 'onOnReserve', name: packet.name, host: this.account, owner: packet.owner});
				else
					clients[i].send({id: 'onReserve', name: packet.name, host: this.account, owner: packet.owner});
			}
			
		} else this.send({id: 'onOnReserveFail', reason: 'duplicate', data: packet});
	} else this.send({id: 'onOnReserveFail', reason: 'args', data: packet});
	
}

Client.prototype.unlist = function(packet) {
	
	//Validate account argument
	if (typeof packet.name == "string") {
		
		//Validate lobby exists
		var lobby = lobbies[packet.name.toLowerCase()];
		if (typeof lobby != "undefined") {
			
			//Validate user is host
			if (lobby.host == this) {
			
				lobby.unlist();
				this.send({id: 'onUnlist', name: packet.name});
				
			} else this.send({id: 'onUnlistFail', reason: 'not host', data: packet});
		} else this.send({id: 'onUnlistFail', reason: 'nonexistent', data: packet});
	} else this.send({id: 'onUnlistFail', reason: 'args', data: packet});
}

Client.prototype.relist = function(packet) {
	
	//Validate name argument
	if (typeof packet.name == "string") {
		
		//Validate lobby exists
		var lobby = lobbies[packet.name.toLowerCase()];
		if (typeof lobby != "undefined") {
			
			//Validate user is host
			if (lobby.host == this) {
				
				//Validate lobby is not listed
				if (lobby.listed === false) {
					
					lobby.unlist();
					this.send({id: 'onRelist', name: packet.name});
					
				} else this.send({id: 'onRelistFail', reason: 'listed', data: packet});
			} else this.send({id: 'onRelistFail', reason: 'not host', data: packet});
		} else this.send({id: 'onRelistFail', reason: 'nonexistent', data: packet});
	} else this.send({id: 'onRelistFail', reason: 'args', data: packet});
}

Client.prototype.unreserve = function(packet) {
	
	//Validate name argument
	if (typeof packet.name == "string") {
		
		//Validate lobby exists
		var lobby = lobbies[packet.name.toLowerCase()];
		if (typeof lobby != "undefined") {
			
			//Validate user is host
			if (lobby.host == this) {
				
				//This method does a global announcement, so no need to explicitly respond
				lobby.unreserve();
				
			} else this.send({id: 'onUnreserveFail', reason: 'not host', data: packet});
		} else this.send({id: 'onUnreserveFail', reason: 'nonexistent', data: packet});
	} else this.send({id: 'onUnreserveFail', reason: 'args', data: packet});
};

Client.prototype.update = function(packet) {
	
	//Validate name argument
	if (typeof packet.name == "string") {
		
		//Validate lobby exists
		var lobby = lobbies[packet.name.toLowerCase()];
		if (typeof lobby != "undefined") {
			
			//Validate user is host
			if (lobby.host == this) {
				
				if (typeof packet.protocol != "undefined")
					lobby.protocol = packet.protocol;
				
				if (typeof packet.date != "undefined")
					lobby.date = packet.date;
				
				if (typeof packet.version != "undefined")
					lobby.version = packet.version;
				
				if (typeof packet.preview != "undefined")
					lobby.preview = packet.preview;
				
				var onUpdateData = {
					id: 'onUpdate',
					name: packet.name,
					protocol: lobby.protocol,
					date: lobby.date,
					version: lobby.version,
					preview: lobby.preview
				};
				
				for (var i = 0; i < clients.length; i++)
					clients[i].send(onUpdateData);
				
			} else this.send({id: 'onUpdateFail', reason: 'not host', data: packet});
		} else this.send({id: 'onUpdateFail', reason: 'nonexistent', data: packet});
	} else this.send({id: 'onUpdateFail', reason: 'args', data: packet});
};

//////////////////////////////////////////////
//	Misc
//////////////////////////////////////////////

Client.prototype.js = function(data) {
	
	if (this.mode == "js") {
		try {
			this.send(eval(data), true);
		} catch (err) {
			this.send(err, true);
		}
	} else this.send({id:'onJSFail', reason:'Access denied.'});
}

//////////////////////////////////////////////
//	Secondary Support Functions
//////////////////////////////////////////////

//Returns the ip:port of the client, if arr is true returns as array
Client.prototype.address = function(arr) {
	
	//Set up our address array
	if (this.type == "ws") var address = [this.socket._socket.remoteAddress, this.socket._socket.remotePort];
	else if (this.type == "s") var address = [this.socket.remoteAddress, this.socket.remotePort];
	
	//Return value
	if (arr === true) return address;
	else return address.join(':');
	
}

Client.prototype.getIP = function() {
	
	var addr = this.address(true)[0];
	
	if (addr.indexOf("192.168" >= 0)) return '68.229.21.36';
	else return addr;
	
	return false;
	
}

Client.prototype.setGroup = function(group) {
	
	//In case the group paramater was a string
	if (typeof group == "string") {
		
		//Is a string, so get the group
		//	This method may require database access if the group is to be created
		//	which is done async, so we must use a callback
		server.getGroup(group, function(group) {
			
			//Finished creating/grabbing group, now do actual setGroup
			this._setGroup(group);
		}.bind(this));
	
	//Group is already existing, so we don't need to worry about callbacks and whatnot
	} else this._setGroup(group);
	
}

//Same as above, except group IS a group...
Client.prototype._setGroup = function(group) {
	if (group.canJoin(this)) {
		
		//Remove them from any present group
		if (this.group != null) this.group.removeClient(this);
		
		//Set local group variable
		this.group = group;
		
		//Tell the group to add the client
		group.addClient(this);
	} else {
		if (group.clients.length == 0) group.destroy();
		
		this.send({id: 'onJoinFail', reason: 'access'});
	}
}

//////////////////////////////////////////////
//	Primary Support Functions
//////////////////////////////////////////////

//For error processing
Client.prototype.error = function() {
	
	//Grab the proper arg list
	var args = Array.prototype.slice.call(arguments);
	
	args.unshift(cc.red);
	
	this.log.apply(this, args);
	
}

//For outputing, prefixes the IP
Client.prototype.log = function() {
	
	//Grab the proper arg list
	var args = Array.prototype.slice.call(arguments);
	
	var d = new Date();
	var t = pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + ":" + pad(d.getMilliseconds(), 3);
	
	//Place the ip address first
	if (typeof this.account == "string") args.unshift(t + cc.yellow, this.account);
	else args.unshift(t + cc.yellow, this.address());
	
	
	//Default color at end
	args.push(cc.default);
	
	//Output
	console.log.apply(this,args);
}

//Sends the client a message
//	data	
Client.prototype.send = function(data, useUtil) {
	
	//Only try to send if client socket is receiving
	if (!(this.socket.readyState == 1 || this.socket.readyState == "open")) return;
	
	try {
		if (useUtil) var s = util.inspect(data);
		else var s = JSON.stringify(data);
		
		if (s.length > 5000) return;
		
		this.log(cc.green, data);
		
		//Send via websocket
		if (this.type == "ws") this.socket.send(s);
		
		//Send via socket
		else if (this.type == "s") this.socket.write(s);
		
	} catch(e){};
}

//Expose Client class
module.exports = Client;
