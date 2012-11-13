var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var programSchema = new Schema({
    'id':          {'type': String, 'unique': true, 'index:': true},
    'title':       {'type': String, 'default': 'Untitled'},
    'author':      {'type': String, 'default': 'Anonymous'},
    'description': {'type': String, 'default': ''},
    'date':        {'type': Date,   'default': Date.now},
    'code':        {'type': String},
    'views':       {'type': Number, 'default': 0},
    'password':    {'type': String, 'default': ''},
    'fork':        {'type': String, 'default': ''},
    'toolchain':   {'type': String, 'default': '0x10code'}
});

module.exports = mongoose.model('Program', programSchema);
