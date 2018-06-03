
import mysql from "mysql2";
import dateformat from "dateformat";

import { colors } from "./util.js";

let db, config;

const log = ( ...args ) => console.log( dateformat( new Date(), "hh:MM:sst" ) + colors.bcyan, ...args, colors.default );
const error = ( ...args ) => console.log( dateformat( new Date(), "hh:MM:sst" ) + colors.cyan, ...args, colors.default );

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

export default connect;
