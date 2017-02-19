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
	this._path = path;
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
		var previous = index > 0 ? history[index-1].hash 
		: '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // null tree

		status("Calculating diff for commit", commit_id);
		return self._git.diff(previous, commit_id)
			.then(function(diff) {

				// filesize updates
				diff.filenames().forEach(function(name) {
					if (!filesizes.hasOwnProperty(name)) {
						filesizes[name] = 0;
					}
					filesizes[name] = filesizes[name] + diff.delta(name);
					Logger.ASSERT(filesizes[name] >= 0);
				});

				// diff summary
				var summary = {}; // filename: summary_ary
				diff.filenames().forEach(function(name) {
					summary[name] = diff.summary(name);
				});

				status("Calculated diff for commit", index, "/", history.length);

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
				history.map(function(commit, index) {
					console.log(index+1, commit.hash);
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


//==============================================================================
//==============================================================================

var Readline = require('readline');
var Spawn = require('./spawn.js');
var CommitStream = require('./commit_stream.js');

Digest.prototype.buildBranchInfo2 = function(branch_name, start, max) {
	var self = this;

	var resolve, reject;
	var promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});

	return self.generateHistory(branch_name) 
	.then(function() {
		status("Parsing commit history");
		var bp = new BranchProcessor(self._repoName, branch_name, self._git);
		var istream = Persist.getHistoryReadStream(self._repoName, branch_name);
		var cs = new CommitStream(istream);
		cs.on("error", function(err) {
			Logger.ERROR("CommitStream ERROR:", err, Logger.CHANNEL.DIGEST);
			reject(err);
		});
		cs.on("commit", function(commit) {
			Logger.DEBUGHI("CommitStream commit()", commit, Logger.CHANNEL.DIGEST);
			Logger.ASSERT(!self._processingCommit);
			cs.pause();
			self._processingCommit = true;
			bp.pushCommit(commit)
				.then(function(){
					self._processingCommit = false;
					cs.resume();
				}).catch(function(err) {
					Logger.ERROR("PersistCommit ERROR:", err, Logger.CHANNEL.DIGEST);
					reject(err);
				});
		});
		cs.on("close", function() {
			Logger.DEBUG("CommitStream close()", Logger.CHANNEL.DIGEST);
			bp.persistRevList().then(function() {
				resolve();
			});
		});
		cs.resume();
	});

	return promise;
};

// saves raw log output to file
Digest.prototype.generateHistory = function(branch_name) {
	var self = this;

	Logger.INFOHI("generateHistory()", branch_name, Logger.CHANNEL.DIGEST);
	
	return Persist.historyExists(self._repoName, branch_name)
		.then(function(exists) {
			if (true)//!exists)
			{
				status("Generating branch history");
				Logger.INFOHI("Calling git log", Logger.CHANNEL.DIGEST);
				var spawn = new Spawn();
				var istream = spawn.getStream();
				istream.pipe(Persist.getHistoryWriteStream(self._repoName, branch_name));
				return spawn.run("git", 
					"--git-dir=" + self._path + "/.git",
					"log", 
					"--first-parent",
					"--reverse",
					"-p");
			} else {
				status("History already exists");
			}
		}).catch(function(err) {
			Logger.ERROR(err, Logger.CHANNEL.DIGEST);
		});
}



var BranchProcessor = function(repo, branch, git) {
	var self = this;
	self._count = 0;
	self._commitIds = [];
	self._repoName = repo;
	self._branch = branch;
	self._git = git;
	self._filesizes = {};
}

BranchProcessor.prototype.pushCommit = function(commit) {
	var self = this;
	Logger.ASSERT(commit.info.hash && commit.info.hash.length == 40);
	if (commit.diff != null) {
		return self.persistCommit(commit);
	} else {
		Logger.WARN("Generating merge diff", commit.info.hash, Logger.CHANNEL.DIGEST);
		var parent = "";
		if (self._commitIds.length > 0) {
			parent = self._commitIds[self._commitIds.length-1];
		}
		return self._git.diff(parent, commit.info.hash)
			.then(function(diff) {
				commit.diff = diff;
				return self.persistCommit(commit);
			});
	}
};

BranchProcessor.prototype.persistCommit = function(commit) {
	var self = this;
	Logger.ASSERT(commit.info.hash && commit.info.hash.length == 40);

	self._count++;
	self._commitIds.push(commit.info.hash);

	console.log(self._count, commit.info.hash);

	Logger.DEBUG("Parsing commit", 
		self._count, 
		JSON.stringify(commit.info), 
		Logger.CHANNEL.DIGEST);

	Logger.DEBUG("Diff summary", 
		commit.diff ? JSON.stringify(commit.diff.diffSummary()) : "",
		'\n', 
		Logger.CHANNEL.DIGEST);

	var summary = {}; // filename: summary_ary

	// filesize updates
	if (commit.diff) {
		commit.diff.filenames().forEach(function(name) {
			if (!self._filesizes.hasOwnProperty(name)) {
				self._filesizes[name] = 0;
			}
			self._filesizes[name] = self._filesizes[name] + commit.diff.delta(name);
			if (self._filesizes[name] < 0) {
				Logger.WARN("Bad filesize", 
					name, 
					self._filesizes[name], 
					"commit", 
					self._count,
					commit.info.hash,
					Logger.CHANNEL.DIGEST);
			}
			Logger.ASSERT(self._filesizes[name] >=0 );
		});

		// diff summary
		summary = commit.diff.diffSummary();
	}

	Logger.DEBUGHI("filesizes", 
	JSON.stringify(self._filesizes),
	'\n', 
	Logger.CHANNEL.DIGEST);

	var count = self._count;
	var filesizes = self._filesizes;

	if (count % 100 == 0)
		status("Saving commit metadata", count);

	return Persist.saveCommit(self._repoName, 
		commit.info.hash, 
		commit.info
	).then(function() {
		if (count % 100 == 0)
			status("Saving diff", count, commit.info.hash);

		return Persist.saveDiff(
			self._repoName, 
			commit.info.hash, 
			commit.diff ? commit.diff.toString() : "", 
			summary
			).then(function() {
				// save filesizes
				return Persist.saveFileSizeSnapshot(
					self._repoName, 
					commit.info.hash, 
					filesizes);
			});
	});
}


BranchProcessor.prototype.persistRevList = function() {
	var self = this;
	return Persist.saveRevisionHistory(self._repoName, 
		self._branch,
		self._commitIds
	);
}


var status = function() {
	//console.log.apply(console, arguments);
};

module.exports = Digest;
