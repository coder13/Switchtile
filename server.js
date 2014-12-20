var fs = require("fs"),
	http = require("http"),
	port = +(process.argv[2]?process.argv[2]:4000),
	users = require('users.json');

process.on('SIGINT', function() {
	fs.writeFileSync("users.json", JSON.stringify(users));
	process.kill(0)
});

var httpServer = http.createServer(function(req, res) {
	console.log(req.url);
	if (req.url == '/' || req.url == '/favicon.ico')
		return;
	if (req.method == 'GET') {
		res.end(JSON.stringify(users[req.url.slice(1)]));
	} else if (req.method == 'POST') {
		req.on('data', function(data) {
			times = JSON.parse(data);
			for (var n in times) {
				users[req.url.slice(1)][n] = users[req.url.slice(1)][n].concat(times[n]);
			}
			console.log(times);
			res.end();
		});
	}
}).listen(port, "0.0.0.0", function() {
	console.log("Listening at: http://localhost:" + port);
});