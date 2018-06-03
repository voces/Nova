
const rooms = [];

export default class Room {

	constructor( name, host ) {

		//Add to global array
		rooms.push( this );
		rooms[ name.toLowerCase() ] = this;

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

		rooms.splice( rooms.indexOf( this ), 1 );
		delete rooms[ this.name.toLowerCase() ];

	}

}

Room.instances = rooms;
