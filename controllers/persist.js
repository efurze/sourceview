'use strict';

var Promise = require('bluebird');
var fs = require('fs');
require('./types.js');

Promise.promisifyAll(fs);

var DATA_DIR = './persist';

var FILESIZE_FILE = 'filesizehistory.json';
var SIZERANGE_FILE = 'filesizerange.json';
var DIFF_FILE = 'diffhistory.json';

var Persist = function() {

};

Persist.prototype.saveFileSizeHistory = function(branch, history) {
	var filename = DATA_DIR + "/" + branch + "." + FILESIZE_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(history));
};

Persist.prototype.getFileSizeHistory = function(branch) {
	var filename = DATA_DIR + "/" + branch + "." + FILESIZE_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};

Persist.prototype.saveFileSizeRange = function(branch, range) {
	var filename = DATA_DIR + "/" + branch + "." + SIZERANGE_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(range));
};

Persist.prototype.getFileSizeRange = function(branch) {
	var filename = DATA_DIR + "/" + branch + "." + SIZERANGE_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};


Persist.prototype.saveDiffHistory = function(branch, history) {
	var filename = DATA_DIR + "/" + branch + "." + DIFF_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(history));
};

Persist.prototype.getDiffHistory = function(branch) {
	var filename = DATA_DIR + "/" + branch + "." + DIFF_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};

module.exports = Persist;