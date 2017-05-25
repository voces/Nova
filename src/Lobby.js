
const lobbies = [];

class Lobby {

	constructor( name, host ) {

		//Add to global array
		lobbies.push( this );
		lobbies[ name.toLowerCase() ] = this;

		this.name = name;
		this.host = host;
		this.clients = [];
		this.lastListed = Date.now();
		this.listed = this.lastListed;

		this.update = setInterval( this.updateTick.bind( this ), 900000 );

	}

	relist() {

		//Only update the time if it's been 15 minutes
		const d = Date.now();
		if ( d - this.listed >= 900000 ) this.listed = d;
		else this.listed = this.lastListed;

		this.lastListed = this.listed;

		this.update = setInterval( this.updateTick.bind( this ), 900000 );

	}

	unlist() {

		this.listed = false;
		clearInterval( this.update );

	}

	updateTick() {

		if ( ! this.listed ) return;

		this.listed = Date.now();
		this.lastListed = this.listed;

	}

	unreserve() {

		lobbies.splice( lobbies.indexOf( this ), 1 );
		delete lobbies[ this.name.toLowerCase() ];

	}

}

Lobby.instances = lobbies;

//Expose Lobby class
module.exports = Lobby;
