var fs = require("fs"),
	Hapi = require("hapi"),
	serverPort = +(process.argv[2]?process.argv[2]:8000),
	users = require('users.json');

process.on('SIGINT', function() {
	fs.writeFileSync("users.json", JSON.stringify(users));
	process.kill(0)
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
})

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
		console.log(request.params.name, data.size, data.time);
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
		console.log(user[size]);
	} else {
		user[size] = user[size].concat(times);
	}
}

// if (req.url == '/' || req.url == '/favicon.ico')
// 		return;
// 	if (req.method == 'GET') {
// 		res.end(JSON.stringify(users[req.url.slice(1)]));
// 	} else if (req.method == 'POST') {
// 		req.on('data', function(data) {
// 			times = JSON.parse(data);
// 			for (var n in times) {
// 				users[req.url.slice(1)][n] = users[req.url.slice(1)][n].concat(times[n]);
// 			}
// 			console.log(times);
// 			res.end();
// 		});
// 	}