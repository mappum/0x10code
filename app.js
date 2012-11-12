// check if the config is there
if (!require('path').existsSync('./config.js')){
	console.log("First create config.js! Copy config_example.js as a template!");
	process.exit(1);
}

// load dependancies
var express = require('express'),
	fs = require('fs'),
	url = require('url'),
	mongoose = require('mongoose'),
	md = require('node-markdown').Markdown,
	moment = require('moment'),
	programDb = require('./controllers/program.js'),
	config = require('./config.js'),
	http = require('http');

mongoose.connect(config.mongoUri);

var app = express.createServer();
app.set('views', './views');
app.set('view engine', 'jade');
app.set('view options', {layout: false});
app.use(express.bodyParser());
app.use(express['static'](__dirname + '/public', { maxAge: 10 * 60 * 1000 }));
app.helpers(require('express-pagination'));

function render(type, res, o, callback) {
	programDb.sort('-date', {password: ''}).limit(25).exec(function(err, recent) {
		recent.moment = moment;

		o.recent = recent;
		o.sitename = config.sitename;
		o.links = config.links;
		o.logo = config.logo;
		res.render(type, o);

		if (callback) callback(o);
	});
}

function incrementViews(program) {
	if(program.viewers.indexOf(program.ip) == -1) {
		program.viewers.push(program.ip);
		program.save();
	}
}

function getIP(req) {
	return req.ip ? req.ip : req.socket.remoteAddress;
}

// scope: Mongoose scope representing the collection to paginate
// currentPage: The current page
// itemsPerPage: Items per page
// callback: function(err, currentItems, totalItems)
function paginate(scope, currentPage, itemsPerPage, callback) {
		var offset = ((currentPage || 1) - 1) * itemsPerPage;

	scope.count(function(err, totalItems) {
		if(!err) {
			scope.limit(itemsPerPage).skip(offset).exec('find', function(err, currentItems) {
				callback(err, currentItems, totalItems);
			});
		} else {
			callback(err);
		}
	});
}

function renderPaginated(scope, type, res, o, callback) {
	var resultsPerPage = 25,
		currentPage = o.currentPage || 1;

	paginate(scope, currentPage, resultsPerPage, function(err, posts, totalPosts) {
		o.posts = posts;
		o.count = totalPosts;
		o.resultsPerPage = resultsPerPage;
		o.currentPage = currentPage;
		render(type, res, o, callback);
	});
}

app.post('/assemble', function(req, res) {
	if(req.body.assembler == 'dcputoolchain') {
		post_data = "file=" + req.body.file;
		var post_options = {
			host: 'services.dcputoolcha.in',
			port: '80',
			path: '/assemble',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': post_data.length
			}
		};

		var post_req = http.request(post_options, function(post_res) {
			post_res.setEncoding('utf8');
			post_res.on('data', function(binary) {
				console.log(binary);
				res.end(binary);
			});
		});

		post_req.write(post_data);
	}
})

app.get('/top', function(req, res) {
	var sorted  = programDb.sort('-viewers', {password: ''});
	renderPaginated(sorted, 'list', res, {
		current: 'top',
		currentPage: req.query.page,
		moment: moment,
		title: 'Top Programs'
	});
});

app.get('/random', function(req, res) {
	programDb.get({password:''}, function(err, posts) {
		if (posts.length > 0){
			var program = posts[Math.floor(posts.length * Math.random())];
			res.redirect('/' + program.id);
		}else{
			// no posts are saved yet, so redirect to root
			res.redirect('/');
		}
	});
});

app.get('/about', function(req, res) {
	res.end('');
});

app.get('/io', function(req, res) {
	render('io', res, {current: 'io'});
});

app.get('/new', function(req, res) {
	res.redirect('/');
});

app.get('/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		if(!program) {
			render('edit', res, {current: '', id: req.params.id});
			return;
		}

		program.current = 'program';

		if(program.password.length > 0) {
			render('password', res, program);
			return;
		}

		programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
			if(forks.length > 0) program.forked = forks.length;

			program.md = md;
			program.moment = moment;

			program.ip = getIP(req);

			render('noedit', res, program, incrementViews);
		});
	});
});

app.post('/:id', function(req, res) {
	programDb.get(req.params.id, function(err, program) {
		program.current = 'program';

		if(req.body.password !== program.password) {
			render('password', res, program);
			return;
		}

		programDb.get({fork: req.params.id, password: ''}, function(err, forks) {
			if(forks.length > 0) program.forked = forks.length;

			program.md = md;
			program.moment = moment;

			program.ip = getIP(req);

			render('noedit', res, program, incrementViews);
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
			render('edit', res, {
				current: 'fork',
				code: program.code,
				fork: req.params.id
			});
		} else {
			render('edit', res, {
				current: ''
			});
		}
	});
});

app.get('/forks/:id', function(req, res) {
	var forks = programDb.get({fork: req.params.id, password: ''});
	renderPaginated(forks, 'list', res, {
		current: 'forks',
		currentPage: req.query.page,
		moment: moment,
		title: 'Forks of ' + req.params.id
	});
});

app.post('/', function(req, res) {
	if(req.body.code.length > 2) {
		programDb.set(req.body, function(err, program) {
			res.end('/' + program.id);
		});
	} else {
		res.end('No code was included. :(', 404);
	}
});

app.get('/', function(req, res) {
	render('edit', res, {current: ''});
});

app.listen(config.port);

