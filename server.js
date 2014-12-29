var fs = require('fs'),
	Hapi = require('hapi'),
	handlebars = require('handlebars'),
	winston = require('winston'),
	passwordHash = require('password-hash'),
	_ = require('underscore'),
	serverPort = (process.argv[2] ? +process.argv[2] : 8000),
	timeout = 0,
	users = {}, times = {};

var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({ // console output
			colorize: true,
			timestamp: true
		}),
		new (winston.transports.File)({ // file output
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

var config = {autosave: 5*60, port:8000};
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
	if (timeout === 0) {
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
    return parseInt(value, 10) + 1;
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
server.route({path: "/users/{name}", method: "GET",
	handler: function(request, reply) {
		var name = request.params.name;
		if (users[name])
			reply(JSON.stringify({times: getTimes(name), pbs: users[name].best}));
		else
			reply(false);
	}
});

// post time for user
server.route({path: "/users/{name}", method: "POST",
	handler: function(request, reply) {
		var data = request.payload;
		data.time = +data.time;
		if (validate(data.user.name, data.user.password)) {
			addTime(request.params.name, data.size, data.time, data.moves);
			
			timeout = 0;
			reply(users[request.params.name].best[data.size]);
		} else {
			reply(false);
		}
	}
});

server.route({path: "/leaderboard", method: "GET",
	handler: function(request, reply) {
		var size = 3 || request.query.size;
		context = {
			single: genTop(size, 'single'),
			avg5: genTop(size, 5),
			avg12: genTop(size, 12),
			avg100: genTop(size, 100),
		};
		console.log(context);
		reply.view('leaderboard', context);
	}
});

// start server
server.start(function() {
	logger.info("Server started at ", server.info.uri);

});

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
function addTime(name, size, time, moves) {
	userTimes = getTimes(name);
	if (!userTimes)
		return;
	if (!userTimes[size]) {
		userTimes[size] = [time];
	} else {
		userTimes[size] = userTimes[size].concat(time);
	}
	userTimes[size] = userTimes[size].slice(userTimes[size].length-100);
	if (users[name].best && users[name].best[size] && users[name].best[size].single) {
		if (time <= users[name].best[size].single.time)
			users[name].best[size].single = {time: time, details: getDetails(time, size, moves)};
		calculateBest(name, size, false);
	} else {
		calculateBest(name, size, true);
	}
}


function getDetails(time, size, moves) {
	return {
		moves: moves,
		mps: Math.round(100000 * moves / time) / 100, // moves per second
		mpp: Math.round(1000 * (moves / ( size * size))) / 1000 // moves per piece
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

	var avgLengths = [5,12,100];

	if (calculateSingle){
		var min = 0;
		for (i = 1; i < userTimes[size].length; i++) {
			if (userTimes[size][i] < userTimes[size][min]) {
				min = i;
			}
		}
		setBest(name, size, 'single', {time: userTimes[size][min], details: {}});
	}

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

function setBest(name, size, avg, time) {
	if (!users[user])
		return false;
	if (!users[user].best)
		users[user].best = {};
	if (!users[user].best[size])
		users[user].best[size] = {};
	users[user].best[size][avg] = time;
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
	return trimmed.substr(0,len - nDigits) + "." + trimmed.substr(len - nDigits, nDigits);
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
	return {time: sum/(list.length-2), times: list};
}

function genTop(size, avg) {
	list = [];
	for (var user in users) {
		if (!users[user].best)
			continue;
		if (!users[user].best[size])
			continue;

		var a = users[user].best[size][avg];

		if (!a && avg == 'single') {
			calculateBest(user, size, true);
			a = users[user].best[size][avg];
		}

		if (a) {
			if (avg == 'single') {
				if (a.details && Object.keys(a.details).length !== 0)
					list.push({name: user, time: pretty(a.time), details: a.details});
				else
					list.push({name: user, time: pretty(a.time)});
			} else {
				list.push({name: user, time: pretty(a.time),
							times: _.map(a.times, pretty).join(', ')});
			}
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