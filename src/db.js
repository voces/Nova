
const mysql = require( "mysql2" );
const dateformat = require( "dateformat" );

const UTIL = require( "./util" );

let db, config;

const log = ( ...args ) => console.log( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.bcyan, ...args, UTIL.colors.default );
const error = ( ...args ) => console.log( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.cyan, ...args, UTIL.colors.default );

function connect( newConfig ) {

	config = newConfig;

	db = mysql.createPool( config.db );

	db.on( "error", () => {

		log( "MySQL disconnected, reconnecting" );
		connect( config );

	} );

	connect.query = ( query, args = null ) =>
        new Promise( ( resolve, reject ) =>
            db.query( query, args, ( err, res ) =>
                err ? reject( err ) : resolve( res ) ) );

	connect.query( "SELECT 1 + 1" )
		.then( () => log( "MySQL connected" ) )
		.catch( error );

}

module.exports = connect;
