var Program = require('../models/program.js');

exports.get = function(id, callback) {
	var scoped;
	if(typeof id === 'string') scoped = Program.findOne({id: id});
	else scoped = Program.find(id);

	if(!callback) {
		return scoped;
	} else {
		scoped.run(callback);
	}
};

exports.set = function(data, callback) {
	var program = new Program();
	if(!data.id) data.id = Math.floor(Math.random() * parseInt('zzzzz', 36)).toString(36);
	
	if(data.title) program.title = data.title;
	if(data.author) program.author = data.author;
	if(data.description) program.description = data.description;
	program.code = data.code;
	program.id = data.id;
	program.password = data.password;
	program.fork = data.fork;
	program.save(function(err) {
		if(callback) callback(err, program);
	});
};

exports.sort = function(field, params, callback) {
	var params = params || {}
		, fields = ['title', 'author', 'description', 'views', 'id', 'date']
		, scoped = Program.find(params).select(fields).sort(field, 'descending');

	if(!callback) {
		return scoped;
	} else {
		scoped.run(callback);
	}
};
