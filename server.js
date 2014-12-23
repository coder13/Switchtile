var fs = require('fs'),
	Hapi = require('hapi'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	users = require('./users.json');

process.on('SIGINT', function() {
	save();
	process.kill(0);
});

setInterval(function() {
  console.log("autosaving....");
  save();
}, 6 * 60 * 1000);

function save() {
	fs.writeFileSync('users.json', JSON.stringify(users));
}

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

server.route({path: "/users/{name}", method: "POST",
	handler: function(request, reply) {
		var data = request.payload;
		data.time = +data.time;
		addTimes(request.params.name, data.size, data.time);
		reply(data);
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

function addTimes(name, size, times) {
	user = getUser(name);
	if (!user[size]) {
		user[size] = [times];
	} else {
		user[size] = user[size].concat(times);
	}
}