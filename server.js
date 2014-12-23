var fs = require("fs"),
	Hapi = require("hapi"),
	serverPort = +(process.argv[2]?process.argv[2]:8000),
	users = require('./users.json');

process.on('SIGINT', function() {
	fs.writeFileSync("users.json", JSON.stringify(users));
	process.kill(0);
});

var server = new Hapi.Server();
server.connection({
	host: '0.0.0.0',
	port: serverPort,
});

server.views({
    engines: { html: require('handlebars') },
    path: "./",
    isCached: false,
});

// routes
server.route({path: "/", method: "GET",
    handler: function(request, reply) {
		reply.view('index');
    }
});

server.route({path: "/users/{name}", method: "GET",
    handler: function(request, reply) {
		reply(JSON.stringify(getUser(request.params.name)));
    }
});

server.start(function() {
    console.log("Server started at ", server.info.uri);
});


function getUser(name) {
	if (!users[name])
		users[name] = {};
	return users[name];
}