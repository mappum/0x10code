var Program = require('../models/program.js');

exports.get = function(id, callback) {
	if(typeof id === 'string') Program.findOne({id: id}, callback);
	else Program.find(id, callback);
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

exports.sort = function(field, callback, params, fields, limit) {
	Program
		.find(params || {}, fields || ['title', 'author', 'description', 'views', 'id', 'date'],
		{sort:[[field, 'descending']], limit: limit || 25}, callback);
};
