var fs = require('fs'),
	Hapi = require('hapi'),
	handlebars = require('handlebars'),
	winston = require('winston'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	timeout = 0,
	users = {}, times = {};

var logger = new (winston.Logger)({
	transports: [new (winston.transports.Console)({
			colorize: true
		})
	],
	colors: {
		info: 'blue',
		warn: 'yellow',
		error: 'red'
	}
});

try {
	users = require('./users.json');
} catch (e) {
	logger.warn('users.json doesn\'t exist.');
}

try {
	times = require('./times.json');
} catch (e) {
	logger.warn('times.json doesn\'t exist');
}


// save upon SIGINT (ctrl + c)
process.on('SIGINT', function() {
	save();
	logger.info('shuting down. Saving and safely stoping....');
	process.kill(0);
});

// autosave
setInterval(function() {
	if (timeout === 0) {
		logger.info("autosaving....");
		save();
		timeout++;
	}
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

handlebars.registerHelper('inc', function(value, options) {
    return parseInt(value) + 1;
});

handlebars.registerHelper('highlight', function(value, options) {
    return value % 2 ? 'even' : 'odd';
});

// setup for serving html pages
server.views({
    engines: {html: require('handlebars')},
    path: "./client",
    isCached: false,
});

// routes

// Serve index.html
server.route({ method: 'GET', path: '/', handler: {view: 'index'}});

server.route({ method: 'GET', path: '/credit', handler: {view: 'credit'}});
server.route({ method: 'GET', path: '/howto', handler: {view: 'howto'}});

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
		var r = addUser(username, password);
		
		if (r) {
			logger.info('Creating user: %s', username);
			reply(true);
		} else {
			var v = validate(username, password);
			if (v)
				logger.info('User: %s logging in', username);
			reply(v);
			
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
		if (users[data.user.name].password == data.user.password) {
			addTimes(request.params.name, data.size, data.time);
			timeout = 0;
			reply(true);
		} else {
			reply(false);
		}
	}
});

server.route({path: "/leaderboard", method: "GET",
	handler: function(request, reply) {
		context = {
			single: genTop(request.query.size, 'single'),
			avg5: genTop(request.query.size, 5),
			avg12: genTop(request.query.size, 12),
			avg100: genTop(request.query.size, 100),
		};
		reply.view('leaderboard', context);
	}
});

// start server
server.start(function() {
	logger.info("Server started at ", server.info.uri);

});

function validate(username, password) {
	return users[username].password === password;
}

function addUser(username, password) {
	if (!users[username]) {
		users[username] = {
			password: password,
			best: {}
		};
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
	if (!userTimes)
		return;
	if (!userTimes[size]) {
		userTimes[size] = [times];
	} else {
		userTimes[size] = userTimes[size].concat(times);
	}
	userTimes[size] = userTimes[size].slice(userTimes[size].length-100);
	calculateBest(name, size);
}

function calculateBest(name, size) {
	user = users[name];
	if (!user.best)
		user.best = {};

	if (!user.best[size]) {
		user.best[size] = {};
	}

	userTimes = getTimes(name);

	var avgLengths = [5,12,100];

	var min = 0;
	for (var i = 1; i < userTimes[size].length; i++) {
		if (userTimes[size][i] < userTimes[size][min]) {
			min = i;
		}
	}
	user.best[size].single = userTimes[size][min];

	for (i = 0; i < avgLengths.length; i++) {
		len = avgLengths[i];
		if (userTimes[size].length >= len) {
			for (j = 0; j <= userTimes[size].length - len; j++) {

				var avg = getAvg(userTimes[size].slice(j, len+j), size);
				if (j === 0 || avg < user.best[size][len]) {
					user.best[size][len] = avg;
				}
			}
		}
	}
	
}

function trim(number, nDigits) {
	if (!number || number == Number.POSITIVE_INFINITY || number == Number.NEGATIVE_INFINITY)
		number = 0;
	var power = Math.pow(10, nDigits);
	var trimmed = "" + Math.round(number * power);
	while (trimmed.length < nDigits + 1) {
		trimmed = "0" + trimmed;
	}
	var len = trimmed.length;
	return trimmed.substr(0,len - nDigits) + "." + trimmed.substr(len - nDigits, nDigits);
}

function pretty(time) {
	time = Math.round(time);
	var mins = Math.floor(time/60000);
	var secs = trim((time - 60000*mins)/1000, 3);
	if (mins === 0) {
		return secs;
	} else {
		return mins + (secs<10?":0":":") + secs;
	}
}

function getAvg(list, size) {
	var max = 0, min = 0;
	var sum = list[0];
	for (var i = 1; i < list.length; i++) {
		if (list[i] > list[max])
			max = i;
		if (list[i] < list[min])
			min = i;
		sum += list[i];
	}
	sum = sum - list[min] - list[max];
	return sum/(list.length-2);
}

function genTop(size, avg) {
	list = [];
	for (var user in users) {
		if (!users[user].best)
			continue;
		if (!users[user].best[size])
			continue;

		if (users[user].best[size][avg]) {
			list.push({name: user, time: pretty(users[user].best[size][avg]), times: []});
		}
	}
	list = list.sort(compare);
	return list;
}

function compare(a,b) {
	if (+a.time < +b.time)
		return -1;
	if (+a.time > +b.time)
		return 1;
	return 0;
}