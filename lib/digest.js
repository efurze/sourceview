'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Git = require('./git.js');
var Persist = require('./persist.js');
var Resolve = require('path').resolve;
var Logger = require('./logger.js');
var Diff = require('./types/diff.js');

var Digest = function(path) {
	path = Resolve(path);
	var parts = path.split('/');
	this._repoName = parts[parts.length-1];

	this._git = new Git(path);
};

Digest.prototype.buildBranchInfo = function(branch_name, start, max) {
	var self = this;
	self.getRevisionHistory(branch_name, max)
		.then(function(history) {
			return self.crawlHistory(branch_name, history);
		});
}

Digest.prototype.crawlHistory = function(branch_name, history) { // eg 'master'
	var self = this;
	var filesizes = {}; // filename: size

	/*
	{
		id: <commit_sha>,
		data: {
			<filename>: summary_ary
		}
	}
	*/

	status("Building initial diff");
	return Promise.each(history, function(commit_info, index) {
		var commit_id = commit_info.hash;
		var previous = index > 0 ? history[index-1].hash : "" ;

		status("Calculating diff for commit", commit_id, previous);
		return self._git.diff(previous, commit_id)
			.then(function(diff) {
				// filesize updates
				diff.filenames().forEach(function(name) {
					if (!filesizes.hasOwnProperty(name)) {
						filesizes[name] = 0;
					}
					filesizes[name] = filesizes[name] + diff.delta(name);
					Logger.ASSERT(filesizes[name] >=0 );
				});

				// diff summary
				var summary = {}; // filename: summary_ary
				diff.filenames().forEach(function(name) {
					summary[name] = diff.summary(name);
				});

				status("Calculated diff for commit", index+1, "/", history.length);

				// save diff
				return Persist.saveDiff(self._repoName, commit_id, diff.toString(), summary)
					.then(function() {
						// save filesizes
						return Persist.saveFileSizeSnapshot(self._repoName, 
							commit_id, 
							filesizes);
					});
			});
	});

};


// returns array of commit ids
Digest.prototype.getRevisionHistory = function(branch_name, max) {
	var self = this;
	status("Building revision history for", branch_name);
	return self._git.log(branch_name)
		.then(function(history) { // array of commits, most recent first
			status("Persisting revision history");
			if (max > 0) {
				max = Math.min(history.length, max);
			} else {
				max = history.length;
			}
			history = history.slice(history.length-max, history.length);
			history.reverse();
			return Persist.saveRevisionHistory(self._repoName, 
				branch_name, 
				history.map(function(commit) {
					return commit.hash;
				}))
				.then(function() {
					return Promise.each(history, function(commit) {
						return Persist.saveCommit(self._repoName, commit.hash, commit);
					});
				})
				.then(function() {
					return history;
				});
		});
};






var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Digest;
