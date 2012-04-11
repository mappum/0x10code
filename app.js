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

function renderWithRecent(type, o, callback) {
	programDb.sort('date', function(err, recent) {
		recent.moment = moment;

		o.recent = recent;
		res.render(type, o);

		if (callback) callback(o);
	}, {password: ''});
}

function incrementViews(program) {
	program.views++;
	program.save();
}

app.get('/top', function(req, res) {
	programDb.sort('views', function(err, posts) {
		renderWithRecent('list', {
			current: 'top',
			posts: posts,
			moment: moment,
			title: 'Top Programs'
		});
	}, {password: ''});
});

app.get('/random', function(req, res) {
	programDb.get({password:''}, function(err, posts) {
		var program = posts[Math.floor(posts.length * Math.random())];
		res.redirect('/' + program.id);
	});
});

app.get('/about', function(req, res) {
	res.end('');
});

app.get('/new', function(req, res) {
	res.redirect('http://0x10co.de');
});

app.get('/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if(!program) {
			res.render('edit', {current: '', id: req.params.id});
			return;
		}

		program.current = 'program';

		if(program.password.length > 0) {
			renderWithRecent('password', program);
			return;
		}

		programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
			if(forks.length > 0) program.forked = forks.length;

			program.md = md;
			program.moment = moment;

			renderWithRecent('noedit', program, incrementViews);
		});
	});
});

app.post('/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		program.current = 'program';

		if(req.body.password !== program.password) {
			renderWithRecent('password', program);
			return;
		}

		programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
			if(forks.length > 0) program.forked = forks.length;

			program.md = md;
			program.moment = moment;

			renderWithRecent('noedit', program, incrementViews);
		});
	});
});

app.get('/raw/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		res.end(program.code || '');
	});
});

app.get('/download/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if(program) {
			res.header('Content-Disposition', 'attachment');
			res.header('filename', url.format(program.title + '.asm'));
		}

		res.end(program.code || '');
	});
});

app.get('/fork/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if (program) {
			renderWithRecent('edit', {
				current: 'fork',
				code: program.code,
				fork: req.params.id
			});
		} else {
			renderWithRecent('edit', {
				current: ''
			});
		}
	});
});

app.get('/forks/:id', function(req, res) {
	programDb.get({fork: req.params.id, password: ''}, function(err, programs) {
		renderWithRecent('list', {
			posts: programs,
			current: 'forks',
			moment: moment,
			title: 'Forks of ' + req.params.id
		});
	});
});

app.post('/', function(req, res) {
	programDb.set(req.body, function(err, program) {
		if(err) {
			console.log(err);
			res.end('', 404);
			return;
		}

		res.end('http://0x10co.de/' + program.id);
	});
});

app.get('/', function(req, res) {
	renderWithRecent('edit', {current: ''});
});

app.listen(8000);

