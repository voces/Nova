//////////////////////////////////////////////
//	Constructor + property set/gets + deconstructor
//////////////////////////////////////////////

function Group(name, callback) {
	
	//Define local variables
	this.name = name;
	this.clients = [];
	this.history = [];
	this.settings = {permissions: {}, ranks: {}};
	
	//Load settings if they exist
	//this.pickupSettings(callback);
	callback(this);
	
	//Log it
	this.log(cc.red, "Reserved group");
	
}

/*Group.prototype.pickupSettings = function(callback) {
	
	async.waterfall([
		
		//Check if group is claimed
		function(callback) {
			var query = "select * from groups where title = ?";
			var args = this.name;
			
			db.query(query, args, function(err, rows, fields) {
				callback(err, rows.length > 0);
			});
		}.bind(this),
		
		function(claimed, callback) {
			if (claimed) {
				
				async.parallel([
					function (callback) {
						var query = "select class, title from ranks where groupid = (select id from groups where title = ?)";
						var args = this.name;
						
						db.query(query, args, function(err, rows, fields) {
							for (var i = 0; i < rows.length; i++)
								this.settings.ranks[rows[i].class] = rows[i].title;
							
							callback(err);
						}.bind(this));
					}.bind(this),
					
					function (callback) {
						var query = "select permission, minClass from permissions where groupid = (select id from groups where title = ?)";
						var args = this.name;
						
						db.query(query, args, function(err, rows, fields) {
							for (var i = 0; i < rows.length; i++)
								this.settings.permissions[rows[i].permission] = rows[i].minClass;
							
							callback(err);
						}.bind(this));
					}.bind(this)
				],
				
				function(err, result) {
					
					callback(err);
				}.bind(this));
			} else callback(true);
		}.bind(this),
	],
	
	
	function(err, result) {
		if (err) this.log(err);
		callback(this);
	}.bind(this));
}*/

Group.prototype.destroy = function() {
	
	for (var i = 0; i < this.clients; i++)
		this.removeClient(this.clients[i]);
	
	groups.splice(groups.indexOf(this), 1);
	delete groups[this.name.toLowerCase()];
	this.log(cc.red, "Group unreserved");
}

//////////////////////////////////////////////
//	Commands
//////////////////////////////////////////////

Group.prototype.command = function(data, client) {
	/*switch (data.gid) {
		case 'changePermission': this.changePermission(client, true, data.rank, data.permission, data.newClass); break;
		case 'changeRank': this.changeRank(client, true, data); break;
		case 'changePermissionBelow': this.changePermissionBelow(client, false, data.rank, data.permission, data.newClass); break;
		case 'changeRankBelow': this.changeRankBelow(client, false, data); break;
		case 'ban': this.ban(client, data.flag, data.account); break;
		case 'squelch': this.squelch(client, data.flag, data.account); break;
		case 'invite': this.invite(client, data.account); break;
	}*/
}

//////////////////////////////////////////////
//	Client handling
//////////////////////////////////////////////

Group.prototype.canJoin = function(client) {
	
	while (this.loadingSettings) {};
	
	//Unclaimed
	if (typeof this.settings.permissions.join == 'undefined' ||
			
			//Anyone can join
			this.settings.permissions.join == 0 ||
			
			//If client meets the class requirement
			(client.groups[this.name] && this.settings.permissions.join >= client.groups[this.name].class))
			
		return true;
	else return false;
}

Group.prototype.addClient = function(client) {
	
	//Tell our clients who are already here
	this.send({id:'onJoin', group: this.name, accounts: [{account: client.account, avatar: client.avatar}]});
	
	//So we can loop through clients...
	this.clients.push(client);
	
	//For easy access of clients...
	this.clients[client.account] = client;
	
	var accounts = [];
	for (var i = 0; i < this.clients.length; i++)
		accounts.push({account: this.clients[i].account, avatar: this.clients[i].avatar});
	
	//Tell the client who's here
	client.send({id:'onGroup', group:this.name, accounts: accounts});
	
	//Log it
	this.log("Added user", client.account);
	//this.history.push([Date.now(), client, 'a']);
	
}

Group.prototype.removeClient = function(client) {
	
	//Remove them from simple array list
	this.clients.splice(this.clients.indexOf(client), 1);
	//delete this.clients[this.clients.indexOf(client)];
	
	//Remove them from specific account list
	delete this.clients[client.account];
	
	//Tell our clients
	this.send({id:'onLeave', group:this.name}, client);
	
	//Log it
	this.log("Removed user", client.account);
	//this.history.push([Date.now(), client, 'r']);
	
	//Remove Group if empty
	if (this.clients.length == 0) this.destroy();
	
}

//////////////////////////////////////////////
//	Group communication
//////////////////////////////////////////////

Group.prototype.send = function(data, account) {
	
	//Append a group name to the packet
	//	This makes data.group effectively reserved for any data transmitting through this function
	data.group = this.name;
	
	//Only allows data.account to be set if an account is passed, otherwise kill it
	if (account) data.account = account.account;
	else delete data.account;
	
	//Loop through clients in group
	for (var x = 0; x < this.clients.length; x++) {
		
		//Send via client
		this.clients[x].send(data);
		
	}
	
	//Log it
	this.log("Broadcasting", data);
	//this.history.push([Date.now(), this, account, 's', data]);
}

//////////////////////////////////////////////
//	Misc
//////////////////////////////////////////////

Group.prototype.log = function() {
	
	//Grab the proper arg list
	var args = Array.prototype.slice.call(arguments);
	
	var d = new Date();
	var t = pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + ":" + pad(d.getMilliseconds(), 3);
	
	//Place the name first
	args.unshift(t + cc.red, this.name);
	
	//Default color at end
	args.push(cc.default);
	
	//Output
	console.log.apply(this,args);
}

//Expose Group class
module.exports = Group;