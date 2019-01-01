
import repl from "repl";

import db from "./src/db";
import Server from "./src/Server";
import config from "./config";
import Client from "./src/Client";
import Room from "./src/Room";

const server = new Server( config );
db( config );

setTimeout( () => {

	const myRepl = repl.start( "" );
	myRepl.context.server = server;
	myRepl.context.clients = Client.instances;
	myRepl.context.rooms = Room.instances;
	myRepl.on( "exit", () => process.exit() );

}, 250 );
