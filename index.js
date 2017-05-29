
const repl = require( "repl" );

const Server = require( "./src/Server" );
const db = require( "./src/db" );

const config = require( "./config" );

const server = new Server( config );
db( config );

setTimeout( () => {

	const myRepl = repl.start( "" );
	myRepl.context.server = server;
	myRepl.on( "exit", () => process.exit() );

}, 250 );
