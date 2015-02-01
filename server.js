//***************************************
//**	Requires
//***************************************

//Standard libraries
fs			= require('fs');
net			= require('net');
WebSocket	= require('ws');
mysql		= require('mysql');
bcrypt		= require('bcryptjs');
util 		= require('util');
async 		= require('async');

//Custom libraries
Client		= require('./server/client.js');
Group		= require('./server/group.js');
Lobby		= require('./server/lobby.js');
util		= new (require('./server/util.js'));

//***************************************
//**	Setup
//***************************************

//Colors index
cc = {
	black: '\x1b[30m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	black: '\x1b[30m',
	bred: '\x1b[1;31m',
	bgreen: '\x1b[1;32m',
	byellow: '\x1b[1;33m',
	bblue: '\x1b[1;34m',
	bmagenta: '\x1b[1;35m',
	bcyan: '\x1b[1;36m',
	bwhite: '\x1b[1;37m',
	default: '\x1b[0;37m',
};

//For padding numbers
pad = function(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

instance = function(obj, type) {
	if (typeof obj == "object")
		if (obj instanceof type) return true;
		else return false;
	else return false;
}

propArrOfArr = function(arr, prop) {
	propArr = [];
	
	for (var i = 0; i < arr.length; i++)
		propArr.push(arr[i][prop]);
	
	return propArr;
}

externalIP = '';

function connectSQL() {
	//Setup MySQL connection
	db = mysql.createConnection({
		host     : 'localhost',
		user     : 'webcraft',
		password : '$yc/gOgZenlvriK.WuqBbv5u',
		database : 'webcraft'
	});
	
	db.connect(function() {
		server.log("MySQL connected");
	});
	
	db.on('error', function(err) {
		server.log('MySQL disconnected, reconnecting');
		connectSQL();
	});
}

connectSQL();

//***************************************
//**	Variables
//***************************************

//Arrays
clients = [];
groups = [];
lobbies = [];

//***************************************
//**	Server
//***************************************

//Load out CA chain first...

ca = [];
chain = fs.readFileSync('ssl/ca-bundle.pem', 'utf8');
chain = chain.split('\n');
cert = [];

var line;
for (var i = 0; i < chain.length; i++) {
	line = chain[i];
	
	if (!(line.length !== 0)) continue;
	
	cert.push(line);
	
	if (line.match(/-END CERTIFICATE-/)) {
		ca.push(cert.join('\n'));
		cert = [];
	}
}

//Our overall server global variable
server = {
	
	//Function that grabs a group from the group array
	//	If it doesn't exist, it'll create it
	getGroup: function(groupName, callback) {
		
		//Check if group exists
		if (typeof groups[groupName.toLowerCase()] == "undefined") {
			
			//It doesn't create it
			new Group(groupName, function(group) {
				
				//Add it to int list
				groups.push(group);
				
				//Add it to easy access
				groups[groupName.toLowerCase()] = group;
				
				callback(group);
				
			}.bind(this));
			
		//Group already exists, return group
		} else callback(groups[groupName.toLowerCase()]);
		
	},
	
	reload: function(degree) {
		for (var i = 0; i < clients.length; i++) {
			clients[i].send({id: 'reload', degree: degree});
		}
	},
	
	//Remove a client from the client array
	//	client	instanceof Client
	removeClient: function(client) {
		
		//Remove them from simple array list
		clients.splice(clients.indexOf(client), 1);
		
		//Remove them from specific account list
		if (client.account) delete clients[client.account.toLowerCase()];
	},
	
	//Websocket server
	wss: new WebSocket.Server({server: require('https').createServer({
		key: fs.readFileSync('ssl/server.key'),
		cert: fs.readFileSync('ssl/server.crt'),
		ca: ca
	}).listen(8082)}),
	
	//On Websocket connection
	onWS: function(socket) {
		clients.push(new Client(socket));
	},
	
	//TCP server
	//On TCP connection
	tcps: new net.Server(function (socket) {
		clients.push(new Client(socket));
	}),
	
	log: function() {
		
		//Grab the proper arg list
		var args = Array.prototype.slice.call(arguments);
		
		//Generate time stamp
		var d = new Date();
		var t = pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + ":" + pad(d.getMilliseconds(), 3);
		
		//Shift color and timestamp at front
		args.unshift(t + cc.cyan);
		
		//Default color at end
		args.push(cc.default);
		
		//Output
		console.log.apply(this,args);
	},
	
	//Init some server stuff
	init: function() {
		
		//Bind a connection event and our socket
		this.wss.on('connection', this.onWS.bind(this));
		
		//Make our TCP server listen to port 8083
		this.tcps.listen(8083);
		
		this.log('Server started');
		
		return this;
	},
}.init();

//For input
var input = process.openStdin();

//Attach input listener
input.addListener("data", function(d) {
	try {console.log(eval(d.toString().substring(0, d.length-2)));}
	catch (err) {console.log(err);}
});
