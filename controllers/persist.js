'use strict';

var Promise = require('bluebird');
var fs = require('fs');
require('./types.js');

Promise.promisifyAll(fs);

var DATA_DIR = './model/data/';

var COMMITS_FILE = 'commithistory.json';
var FILESIZE_FILE = 'filesizehistory.json';
var SIZERANGE_FILE = 'filesizerange.json';
var DIFF_FILE = 'diffhistory.json';

var COMMIT_DIR = "/commits";
var DIFF_DIR = "/diffs";
var DIFF_SUMMARY_DIR = "/diff_summaries";

var Persist = function(repo_name) {
	var self = this;
	self._repoName = repo_name;
	var dir = DATA_DIR + repo_name;	
	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
    }

    self._diffDir = dir + DIFF_DIR;
    if (!fs.existsSync(self._diffDir)){
    	fs.mkdirSync(self._diffDir);
    }

    self._summaryDir = dir + DIFF_SUMMARY_DIR;
    if (!fs.existsSync(self._summaryDir)){
    	fs.mkdirSync(self._summaryDir);
    }
};

Persist.prototype.saveRevisionHistory = function(branch, history) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + COMMITS_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(history));
};

Persist.prototype.saveDiff = function(id, diffstr, summary) {
	var self = this;
	var filename = self._diffDir + '/' + id;
	return fs.writeFileAsync(filename, diffstr)
		.then(function() {
			return fs.writeFileAsync(self._summaryDir + '/' + id, JSON.stringify(summary));
		});
};

Persist.prototype.saveCommit = function(id, commit) {
	var self = this;
	var filename = self._commitDir + '/' + id;
	return fs.writeFileAsync(filename, JSON.stringify(commit));
};

Persist.prototype.saveFileSizeHistory = function(branch, history) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + FILESIZE_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(history));
};

Persist.prototype.getFileSizeHistory = function(branch) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + FILESIZE_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};

Persist.prototype.saveFileSizeRange = function(branch, range) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + SIZERANGE_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(range));
};

Persist.prototype.getFileSizeRange = function(branch) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + SIZERANGE_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};

/*
	history = {
		commit:
		diffs: {
			'filename': {
				'summary':,
				'chunks':
			}
		}
	}
*/
Persist.prototype.saveDiffHistory = function(branch, history) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + DIFF_FILE;
	return fs.writeFileAsync(filename, JSON.stringify(history));
};

Persist.prototype.getDiffHistory = function(branch) {
	var filename = DATA_DIR + this._repoName + "/" + branch + "." + DIFF_FILE;
	return fs.readFileAsync(filename)
		.then(function(data) {
			return JSON.parse(data);
		});
};

module.exports = Persist;