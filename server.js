var fs = require('fs'),
	Hapi = require('hapi'),
	handlebars = require('handlebars'),
	winston = require('winston'),
	passwordHash = require('password-hash'),
	_ = require('underscore'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	timeout = 0,
	users = {},
	times = {};

var logger = new(winston.Logger)({
	transports: [
		new(winston.transports.Console)({ // console output
			colorize: true,
			timestamp: true
		}),
		new(winston.transports.File)({ // file output
			filename: 'switchtile.log',
			timestamp: true,
			json: false,
			prettyPrint: true
		})
	],
	colors: {
		info: 'blue',
		warn: 'yellow',
		error: 'red'
	}
});

var config = {
	autosave: 5 * 60,
	port: 8000
};
try {
	config = require('./config.json');
} catch (e) {
	logger.warn('config.json doesn\'t exist.');
}

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
	if (timeout == 0) {
		logger.info("autosaving....");
		save();
		timeout++;
	}
}, config.autosave * 1000);

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
	return +value + 1;
});

handlebars.registerHelper('highlight', function(value, options) {
	return value % 2 ? 'even' : 'odd';
});

// setup for serving html pages
server.views({
	engines: {
		html: require('handlebars')
	},
	path: "./client",
	isCached: false,
});

// routes

// Serve index.html
server.route({
	method: 'GET',
	path: '/',
	handler: {
		view: 'index'
	}
});

server.route({
	method: 'GET',
	path: '/credit',
	handler: {
		view: 'credit'
	}
});
server.route({
	method: 'GET',
	path: '/howto',
	handler: {
		view: 'howto'
	}
});

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

server.route({
	path: "/login",
	method: "POST",
	handler: function(request, reply) {
		var username = request.payload.username,
			password = request.payload.password;
		if (!username || username === null || username == 'null' ||
			!password || password === null || password == 'null' || password.length < 6) {
			reply(false);
			return;
		}
		var r = addUser(username, password);

		if (r) {
			logger.info('Creating user: %s', username);
			reply(true);
		} else {
			var v = validate(username, password);
			if (v)
				logger.info('User: %s logging in', username);
			else {
				logger.info('User: %s tried to login in.', username);
			}
			reply(v);

		}
	}
});

// Get all times for user
server.route({
	path: "/users/{name}",
	method: "GET",
	handler: function(request, reply) {
		var name = request.params.name;
		if (users[name])
			reply(JSON.stringify({
				times: getTimes(name),
				pbs: users[name].best
			}));
		else
			reply(false);
	}
});

// post time for users
server.route({
	path: "/users/{name}",
	method: "POST",
	handler: function(request, reply) {
		timeout = 0;
		var data = request.payload;
		if (validate(data.user.name, data.user.password)) {
			addTime(request.params.name, data.size, +data.time, +data.moves);

			reply(users[request.params.name].best[data.size]);
		} else {
			reply(false);
		}
	}
});

server.route({
	path: "/leaderboard",
	method: "GET",
	handler: function(request, reply) {
		var size = request.query.size || 3;
		context = {
			single: genTop(size, 'single'),
			avg5: genTop(size, 5),
			avg12: genTop(size, 12),
			avg100: genTop(size, 100),
		};
		reply.view('leaderboard', context);
	}
});

// start server
server.start(function() {
	logger.info("Server started at ", server.info.uri);

});

/*
 *  Helper functions
 */


//users

function validate(username, password) {
	return passwordHash.verify(password, users[username].password);
	// return users[username].password === password;
}

function addUser(username, password) {
	if (!users[username]) {
		users[username] = {
			password: passwordHash.generate(password),
			best: {}
		};
		return true;
	} else if (!users[username].password) {
		users[username].password = passwordHash.generate(password);
		return true;
	} else {
		return false;
	}
}

//times 

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
function addTime(name, size, time, moves) {
	userTimes = getTimes(name);
	if (!userTimes)
		return;
	if (!userTimes[size]) {
		userTimes[size] = [time];
	} else {
		userTimes[size] = userTimes[size].concat(time);
	}
	userTimes[size] = userTimes[size].slice(userTimes[size].length - 100);

	if (isBest(name, size, 'single', time)) {
		setBest(name, size, 'single', {
			time: time,
			details: getDetails(time, size, moves)
		});
	}
	calculateBest(name, size, false);
}


function getDetails(time, size, moves) {
	return {
		moves: moves,
		mps: Math.round(100000 * moves / time) / 100, // moves per second
		mpp: Math.round(1000 * (moves / (size * size))) / 1000 // moves per piece
	};
}

function calculateBest(name, size, calculateSingle) {
	user = users[name];
	if (!user.best)
		user.best = {};

	if (!user.best[size]) {
		user.best[size] = {};
	}

	userTimes = getTimes(name);

	var avgLengths = [5, 12, 100];

	if (calculateSingle) {
		var min = 0;
		for (i = 1; i < userTimes[size].length; i++) {
			if (userTimes[size][i] < userTimes[size][min]) {
				min = i;
			}
		}
		setBest(name, size, 'single', {
			time: userTimes[size][min]
		});
	}

	for (i = 0; i < avgLengths.length; i++) {
		len = avgLengths[i];
		if (userTimes[size].length >= len) {
			for (j = 0; j <= userTimes[size].length - len; j++) {

				var avg = getAvg(userTimes[size].slice(j, len + j), size);
				if (j === 0 || avg < user.best[size][len]) {
					user.best[size][len] = avg;
				}
			}
		}
	}

}

function isBest(name, size, avg, time) {
	if (!users[name]) return false;
	if (!users[name].best[size]) return true;
	if (!users[name].best[size][avg] && avg == 'single') {
		var min = 0;
		for (i = 1; i < times[name][size].length; i++) {
			if (times[name][size][i] < times[name][size][min]) {
				min = i;
			}
		}
		users[name].best[size].single = {
			time: times[name][min]
		};
		return min <= users[name].best[size][avg].time;
	}
	return time <= users[name].best[size][avg].time;
}

function setBest(name, size, avg, time) {
	if (!users[name])
		return false;
	if (!users[name].best)
		users[name].best = {};
	if (!users[name].best[size])
		users[name].best[size] = {};
	users[name].best[size][avg] = time;
	return true;
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
	return trimmed.substr(0, len - nDigits) + "." + trimmed.substr(len - nDigits, nDigits);
}

function pretty(time) {
	time = Math.round(time);
	var mins = Math.floor(time / 60000);
	var secs = trim((time - 60000 * mins) / 1000, 3);
	if (mins === 0) {
		return secs;
	} else {
		return mins + (secs < 10 ? ":0" : ":") + secs;
	}
}

function getAvg(list, size) {
	var max = 0,
		min = 0;
	var sum = list[0];
	for (var i = 1; i < list.length; i++) {
		if (list[i] > list[max])
			max = i;
		if (list[i] < list[min])
			min = i;
		sum += list[i];
	}
	sum = sum - list[min] - list[max];
	return {
		time: sum / (list.length - 2),
		times: list
	};
}

function genTop(size, avg) {
	list = [];
	for (var user in users) {
		if (!users[user].best)
			continue;
		if (!users[user].best[size])
			continue;

		var entry = users[user].best[size][avg];


		if ((!entry || !users[user].best[size][avg]) && avg == 'single') {
			calculateBest(user, size, true);
			entry = users[user].best[size].single;
		}

		if (entry) {
			if (avg == 'single') {

				if (entry.details && Object.keys(entry.details).length != 0)
					list.push({
						name: user,
						time: pretty(entry.time),
						details: entry.details
					});
				else
					list.push({
						name: user,
						time: pretty(entry.time)
					});
			} else {
				list.push({
					name: user,
					time: pretty(entry.time),
					times: _.map(entry.times, pretty).join(', ')
				});
			}
		}

	}
	list = list.sort(compare);
	return list;
}

function compare(a, b) {
	if (+a.time < +b.time)
		return -1;
	if (+a.time > +b.time)
		return 1;
	return 0;
}