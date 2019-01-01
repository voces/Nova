
export default class Collection extends Array {

	constructor( ...args ) {

		super( ...args );

		Object.defineProperties( this, {
			key: { value: Collection.defaultKey, writable: true },
			dict: { value: {} }
		} );

	}

	add( ...items ) {

		this.push( ...items );

		for ( let i = 0; i < items.length; i ++ ) {

			console.log( "key", this.key );
			console.log( "value", i, items[ i ][ this.key ] );
			if ( items[ i ][ this.key ] )
				this.dict[ items[ i ][ this.key ] ] = items[ i ];

		}

	}

	replace( arr ) {

		this.splice( 0 );
		this.dict = {};

		this.add( ...arr );

	}

	remove( item ) {

		const index = this.indexOf( item );
		if ( index >= 0 ) this.splice( index, 1 );

		//Is the second condition required? How does it effect speed?
		if ( item[ this.key ] )
			delete this.dict[ item[ this.key ] ];

	}

}

Collection.defaultKey = "key";
