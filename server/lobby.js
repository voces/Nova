//////////////////////////////////////////////
//	Lobby Class
//////////////////////////////////////////////

function Lobby(name, host) {
	
	//Add to global array
	lobbies.push(this);
	lobbies[name.toLowerCase()] = this;
	
	this.name = name;
	this.host = host;
	this.clients = [];
	this.lastListed = new Date();
	this.listed = this.lastListed;
	
	this.update = setInterval(this.updateTick.bind(this), 900000);
	
}

Lobby.prototype.relist = function() {
	
	//Only update the time if it's been 15 minutes
	var d = new Date();
	if (d - this.listed >= 900000) this.listed = d;
	else this.listed = this.lastListed;
	
	this.lastListed = this.listed;
	
	this.update = setInterval(this.updateTick.bind(this), 900000);
	
}

Lobby.prototype.unlist = function() {
	
	this.listed = false;
	clearInterval(this.update);
	
}

Lobby.prototype.updateTick = function() {
	
	if (this.listed) {
		this.listed = new Date();
		this.lastListed = this.listed;
	}
	
}

Lobby.prototype.unreserve = function() {
	for (var i = 0; i < clients.length; i++)
		clients[i].send({id: 'onUnreserve', name: this.name, host: this.account});
	
	lobbies.splice(lobbies.indexOf(this), 1);
	delete lobbies[this.name.toLowerCase()];
}

//Expose Lobby class
module.exports = Lobby;
