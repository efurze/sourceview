var Promise = require('bluebird');
var Logger = require('./logger.js');
var spawn = require('child_process').spawn;
var Readable = require('stream').Readable;

var Spawn = function() {
	var self = this;
	self._readStream = new Readable;
	self._readStream._read = function() {

	};
};


Spawn.prototype.getStream = function() {
	return this._readStream;
}

Spawn.prototype.run = function(command, args) {
	var self = this;
	
	var cmd_args = [];
	for(var i=1; i < arguments.length; i++) {
		cmd_args.push(arguments[i]);
	}

	var resolve, reject;
	var promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});

	var sp = spawn(command, cmd_args);

	sp.on('error', function(err) {
		reject("Spawn error: " + err);
	});

	sp.stdout.on('data', function(data) {
		self._readStream.push(String(data));
		//console.log(String(data));
	});

	sp.stderr.on('data', function(err) {
		reject("Spawn error: " + err);
	});

	sp.on('close', function(code) {
		resolve(code);
	});
	return promise;
}

module.exports = Spawn;
