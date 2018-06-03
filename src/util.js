
import fs from "fs";

export const colors = {
	red: "\x1b[0;31m",
	green: "\x1b[0;32m",	// send
	yellow: "\x1b[0;33m",
	blue: "\x1b[0;34m",	// Client
	magenta: "\x1b[0;35m",	// receive
	cyan: "\x1b[0;36m",	// Server
	white: "\x1b[0;37m",
	black: "\x1b[0;30m",

	bred: "\x1b[1;31m",
	bgreen: "\x1b[1;32m",
	byellow: "\x1b[1;33m",
	bblue: "\x1b[1;34m",
	bmagenta: "\x1b[1;35m",
	bcyan: "\x1b[1;36m",
	bwhite: "\x1b[1;37m",
	default: "\x1b[0;0m"
};

export const instance = ( obj, type ) => {

	if ( typeof obj == "object" )
		if ( obj instanceof type ) return true;
		else return false;
	else return false;

};

export const matchAny = ( a, b ) => {

	if ( typeof a == "object" && a instanceof Array ) {

		for ( let i = 0; i < a.length; i ++ )
			if ( a[ i ] != b ) return true;

		return false;

	}

	return false;

};

function promisify( func ) {

	return ( ...args ) =>
		new Promise( ( resolve, reject ) =>
			func( ...args, ( err, res ) =>
				err ? reject( err ) : resolve( res ) ) );

}

export const readFile = promisify( fs.readFile );

