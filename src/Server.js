
const https = require( "https" );
const path = require( "path" );

const dateformat = require( "dateformat" );
const ws = require( "ws" );

const Client = require( "./Client.js" );
const UTIL = require( "./util.js" );

const readKey = async filepath => ( await UTIL.readFile( path.join( __dirname, filepath ) ) ).toString();

class Server {

	constructor( config ) {

		this.config = config;

		this.loadKeys()
			.catch( err => console.error( err ) )
            .then( keys => this.start( keys ) );

	}

	async loadKeys() {

		const keys = await Promise.all(
        	[
				readKey( this.config.keys.key ),
				readKey( this.config.keys.cert ),
				readKey( this.config.keys.ca ).then( file => {

    	        	const lines = file.split( "\n" ),
    	        		ca = [];

    	        	for ( let i = 0, n = 0; i < lines.length; i ++ )
    	        		if ( lines[ i ].match( /END CERTIFICATE/ ) )
    	        			ca.push( lines.slice( n, i + 1 ).join( "\n" ) ), n = i + 1;

    	        	return Promise.resolve( ca );

    			} )

			] );

		return {
			key: keys[ 0 ],
			cert: keys[ 1 ],
			ca: keys[ 2 ]
		};

	}

	start( keys ) {

		this.https = https.createServer( keys, ( req, res ) => {

			res.writeHead( "200" );
			res.end( "Hello World!" );

		} ).listen( this.config.port, () => {

			//Websocket server
			this.wss = new ws.Server( { server: this.https } );
			this.wss.on( "connection", socket => new Client( socket ) );

			this.log( "WSS listening on", this.config.port );

		} );

		this.https.on( "error", err => {

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

		console.log( dateformat( new Date(), "hh:MM:sst" ) + UTIL.colors.cyan, ...args, UTIL.colors.default );

	}

}

module.exports = Server;
