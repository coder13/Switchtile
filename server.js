var fs = require('fs'),
	Hapi = require('hapi'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	users = require('./users.json');

// save upon SIGINT (ctrl + c)
process.on('SIGINT', function() {
	save();
	process.kill(0);
});

// autosave
setInterval(function() {
  console.log("autosaving....");
  save();
}, 6 * 60 * 1000);

// save times
function save() {
	fs.writeFileSync('users.json', JSON.stringify(users));
}


var server = new Hapi.Server();
server.connection({
	host: '0.0.0.0',
	port: serverPort,
});

// setup for serving html pages
server.views({
    engines: {html: require('handlebars')},
    path: "./client",
    isCached: false,
});

// routes

// Serve index.html
server.route({ method: 'GET', path: '/', handler: function(req, reply) {
    reply.view('index');
}});

// Serve everything else
server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
        directory: {
            path: 'client'
        }
    }
});

// Get all times for user
server.route({path: "/users/{name}", method: "GET",
    handler: function(request, reply) {
		reply(JSON.stringify(getUser(request.params.name)));
    }
});

// post time for user
server.route({path: "/users/{name}", method: "POST",
	handler: function(request, reply) {
		var data = request.payload;
		data.time = +data.time;
		addTimes(request.params.name, data.size, data.time);
		reply(data);
	}
});

// start server
server.start(function() {
    console.log("Server started at ", server.info.uri);
});

// get user. If user doesn't exist, make user
function getUser(name) {
	if (!users[name])
		users[name] = {};
	return users[name];
}

// add time for size. If size doesn't exist, make it
function addTimes(name, size, times) {
	user = getUser(name);
	if (!user[size]) {
		user[size] = [times];
	} else {
		user[size] = user[size].concat(times);
	}
}