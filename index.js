
const repl = require( "repl" );

const Server = require( "./src/Server" );
const db = require( "./src/db" );

const config = require( "./config" );

const server = new Server( config );
db( config );

const myRepl = repl.start( "> " );
myRepl.context.server = server;
