
import repl from "repl";

import db from "./src/db";
import Server from "./src/Server";
import config from "./config";

const server = new Server( config );
db( config );

setTimeout( () => {

	const myRepl = repl.start( "" );
	myRepl.context.server = server;
	myRepl.on( "exit", () => process.exit() );

}, 250 );
