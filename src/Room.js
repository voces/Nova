
import Collection from "./Collection.js";

const rooms = new Collection();
rooms.key = "lowerName";

export default class Room {

	constructor( name, host ) {

		this.name = name;
		this.lowerName = this.name.toLowerCase();
		this.host = host;
		this.clients = [];
		this.lastListed = Date.now();
		this.listed = this.lastListed;

		//Add to global array
		rooms.add( this );

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

		rooms.remove( this );

	}

}

Room.instances = rooms;
