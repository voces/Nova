
import http from "http";
import https from "https";
import path from "path";

import dateformat from "dateformat";
import ws from "ws";

import Client from "./Client.js";
import UTIL from "./util.js";

const readKey = async filepath => ( await UTIL.readFile( path.join( __dirname, filepath ) ) ).toString();

export default class Server {

	constructor( config ) {

		this.config = config;

		const promise = this.config.keys ? this.loadKeys() : Promise.resolve();

		promise
			.then( keys => this.start( keys ) )
			.catch( err => console.error( err ) );

	}

	async loadKeys() {

		const keys = await Promise.all(
        	[
				readKey( this.config.keys.key ),
				readKey( this.config.keys.cert ),
				readKey( this.config.keys.ca ).then( file => {

    	        	const lines = file.toString().split( "\n" ),
    	        		ca = [];

    	        	for ( let i = 0, n = 0; i < lines.length; i ++ )
    	        		if ( lines[ i ].match( /END CERTIFICATE/ ) )
    	        			ca.push( lines.slice( n, i + 1 ).join( "\n" ) ), n = i + 1;

    	        	return Promise.resolve( ca );

    			} )

			] ).catch( err => err );

		if ( typeof keys === "object" && keys instanceof Error ) {

			switch ( keys.code ) {

				case "ENOENT": this.error( `File for SSL not found at '${keys.path}'` ); break;
				default: this.error( keys );

			}

			process.exit( 1 );

		}

		return {
			key: keys[ 0 ],
			cert: keys[ 1 ],
			ca: keys[ 2 ]
		};

	}

	start( keys ) {

		this.server = ( keys ? https : http ).createServer( keys, ( req, res ) => {

			res.writeHead( "200" );
			res.end( "Hello World!" );

		} ).listen( this.config.port, () => {

			//Websocket server
			this.wss = new ws.Server( { server: this.server } );
			this.wss.on( "connection", socket => new Client( socket ) );

			this.log( "WSS listening on", this.config.port );

		} );

		this.server.on( "error", err => {

			if ( err.code === "EADDRINUSE" ) {

				this.error( "Port", this.config.port, "already in use!" );
				process.exit( 1 );

			} else {

				this.error( err );
				process.exit( 1 );

			}

		} );

		this.log( "Server started" );

	}

	log( ...args ) {

		console.log( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.bcyan, ...args, UTIL.colors.default );

	}

	error( ...args ) {

		console.error( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.cyan, ...args, UTIL.colors.default );

	}

}
