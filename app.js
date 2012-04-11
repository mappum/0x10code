var express = require('express'),
	fs = require('fs'),
	url = require('url'),
	mongoose = require('mongoose'),
	md = require('node-markdown').Markdown,
	moment = require('moment'),
	programDb = require('./controllers/program.js');

mongoose.connect('mongodb://localhost/0x10code');

var app = express.createServer();
app.set('views', './views');
app.set('view engine', 'jade');
app.set('view options', {layout: false});
app.use(express.bodyParser());

var resources = [
	'/bootstrap/css',
	'/bootstrap/js',
	'/bootstrap/img',
	'/css',
	'/js',
	'/img'
];
for(var i = 0; i < resources.length; i++) {
	app.get(resources[i] + '/:file', function(req, res) {
		fs.readFile('.' + req.url,
		function(err, data) {
			if(err) res.end('', 404);
			else res.end(data);
		});
	});
}

function getRecent(callback) {
	programDb.sort('date', function(err, recent) {
		recent.moment = moment;
		callback(err, recent);
	}, {password: ''});
}

app.get('/top', function(req, res) {
	programDb.sort('views', function(err, posts) {
		getRecent(function(err, recent) {
			res.render('list', {posts: posts, current:'top', recent: recent, moment: moment, title: 'Top Programs'});
		});
	}, {password: ''});
});

app.get('/random', function(req, res) {
	programDb.get({password:''}, function(err, posts) {
		getRecent(function(err, recent) {
			var program = posts[Math.floor(posts.length * Math.random())];
			res.redirect('/' + program.id);
		});
	});
});

app.get('/about', function(req, res) {
	res.end('');
});

app.get('/new', function(req, res) {
	res.redirect('http://0x10co.de');
});

app.get('/:id', function(req, res) {
	getRecent(function(err, recent) {
		programDb.get(req.params.id, function(err, program) {
			programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
				if(program) {
					if(program.password.length === 0) {
						program.current = 'program';
						program.md = md;
						program.recent = recent;
						program.moment = moment;
						if(forks.length > 0) program.forked = forks.length;
						res.render('noedit', program);
						program.views++;
						program.save();
					} else {
						program.current = 'program';
						program.recent = recent;
						res.render('password', program);
					}
				} else {
					res.render('edit', {current: '', id: req.params.id});
				}
			});
		});
	});
});

app.post('/:id', function(req, res) {
	getRecent(function(err, recent) {
		programDb.get(req.params.id, function(err, program) {
			programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
				if(req.body.password === program.password) {
					program.current = 'program';
					program.recent = recent;
					program.md = md;
					program.moment = moment;
					if(forks.length > 0) program.forked = forks.length;
					res.render('noedit', program);
					program.views++;
					program.save();
				} else {
					program.current = 'program';
					program.recent = getRecent();
					res.render('password', program);
				}
			});
		});
	});
});

app.get('/raw/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if(program) res.end(program.code);
		else res.end('');
	});
});

app.get('/download/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if(program) {
			res.header('Content-Disposition', 'attachment');
			res.header('filename', url.format(program.title + '.asm'));
			res.end(program.code);
		} else res.end('');
	});
});

app.get('/fork/:id', function(req, res) {
	getRecent(function(err, recent) {
		programDb.get(req.params.id, function(err, program) {
			if(program) {
				res.render('edit', {current: 'fork', code: program.code, recent: recent,
					fork: req.params.id});
			} else {
				res.render('edit', {current: '', recent: recent});
			}
		});
	});
});

app.get('/forks/:id', function(req, res) {
	getRecent(function(err, recent) {
		programDb.get({fork: req.params.id, password: ''}, function(err, programs) {
			res.render('list', {posts: programs, current:'forks', recent: recent, moment: moment,
				title: 'Forks of ' + req.params.id});
		});
	});
});

app.post('/', function(req, res) {
	programDb.set(req.body, function(err, program) {
		if(!err) {
			res.end('http://0x10co.de/' + program.id);
		} else {
			console.log(err);
			res.end('', 404);
		}
	});
});

app.get('/', function(req, res) {
	getRecent(function(err, recent) {
		res.render('edit', {current: '', recent: recent});
	});
});

app.listen(8000);

