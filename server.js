var fs = require('fs'),
	Hapi = require('hapi'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	users = require('./users.json'),
	times = require('./times.json');

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
	fs.writeFileSync('times.json', JSON.stringify(times));
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

server.route({path: "/login", method: "POST",
	handler: function(request, reply) {
		var username = request.payload.username,
			password = request.payload.password;
		r = addUser(username, password);
		console.log(r ? "user: " + username + " created" :
						"user: "  + username + " already exists");
		if (r) {
			reply(true);
		} else {
			reply(validate(username, password));
		}
	}
});

// Get all times for user
server.route({path: "/users/{name}", method: "GET",
    handler: function(request, reply) {
		reply(JSON.stringify(getTimes(request.params.name)));
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

function validate(username, password) {
	return users[username] === password;
}

function addUser(username, password) {
	if (!users[username]) {
		users[username] = password;
		return true;
	} else {
		return false;
	}
}

// get user. If user doesn't exist, make user
function getTimes(username) {
	if (users[username]) {
		if (!times[username])
			times[username] = {};
		return times[username];
	}
	return;
}

// add time for size. If size doesn't exist, make it
function addTimes(name, size, times) {
	userTimes = getTimes(name);
	if (!userTimes[size]) {
		userTimes[size] = [times];
	} else {
		userTimes[size] = userTimes[size].concat(times);
	}
}