var Program = require('../models/program.js');

exports.get = function(id, callback) {
	var scoped;
	if(typeof id === 'string') scoped = Program.findOne({id: id});
	else scoped = Program.find(id);

	if(!callback) {
		return scoped;
	} else {
		scoped.exec(callback);
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
	params = params || {};

	var fields = {'title': 1, 'author': 1, 'description': 1, 'viewers': 1, 'id': 1, 'date': 1},
		scoped = Program.find(params).select(fields).sort(field);

	if(!callback) {
		return scoped;
	} else {
		scoped.run(callback);
	}
};
