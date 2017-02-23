var Promise = require('bluebird');
var Logger = require('./logger.js');
var spawn = require('child_process').spawn;

var Spawn = function(istream) {
	var self = this;
	self._readStream = istream;
};



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

	var result = "";

	var sp = spawn(command, cmd_args);

	sp.on('error', function(err) {
		reject("Spawn error: " + err);
	});

	sp.stdout.on('data', function(data) {
		if (self._readStream) {
			self._readStream.push(String(data));
		} else {
			result += String(data);
		}
	});

	sp.stderr.on('data', function(err) {
		reject("Spawn error: " + err);
	});

	sp.on('close', function(code) {
		if (self._readStream) {
			resolve(code);
		} else {
			resolve(result);
		}
	});
	return promise;
}

module.exports = Spawn;
