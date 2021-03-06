'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Git = require('./git.js');
var Persist = require('./persist.js');
var Resolve = require('path').resolve;
var Logger = require('./logger.js');
var Diff = require('./types/diff.js');
var Readable = require('stream').Readable;

var VALIDATE_SIZE = false;

var Digest = function(path) {
	path = Resolve(path);
	var parts = path.split('/');
	this._path = path;
	this._repoName = parts[parts.length-1];

	this._git = new Git(path);
};



Digest.prototype.buildBranchInfo = function(branch_name, start, max) {
	var self = this;
	start = start || 0;
	max = max || 0;


	status("Building revision history for", branch_name);
	return self.saveRevList(branch_name)
		.then(function(history) {
			if (max > 0)
				history = history.slice(start, start+max);
			return self.crawlHistory(branch_name, history);
		});		
}

// returns array of shas
Digest.prototype.saveRevList = function(branch_name) {
	var self = this;


	status("Building revision history for", branch_name);
	return self.getRevList(branch_name)
		.then(function(history) {
			status("Persisting revision history");
			return Persist.saveRevisionHistory(self._repoName, 
				branch_name, 
				history).then(function(){return history;});
		});

}

// @history = array of sha's
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

	var skipping = false;
	return Promise.each(history, function(commit_id, index) {
		var previous = index > 0 ? history[index-1] 
		: '';

		if (Persist.revisionDataExists(self._repoName, branch_name, commit_id)) {
			skipping = true;
			return;
		}

		return (function load() {
			if (skipping) {
				status("loading snapshot after skip", previous);
				skipping = false;
				return Persist.sizeSnapshot(self._repoName, [{id:previous}])
					.then(function(sizes) {
						filesizes = sizes[previous];
					});
			} else {
				return Promise.resolve();
			}
		})()
		.then(function() {
			status("Calculating diff for commit", index, "/", history.length, commit_id);
			return self._git.diff(previous, commit_id)
				.then(function(diff) {
					// filesize updates
					diff.filenames().forEach(function(name) {
						if (!filesizes.hasOwnProperty(name)) {
							filesizes[name] = 0;
						}
						filesizes[name] = filesizes[name] + diff.delta(name);
						Logger.ASSERT(filesizes[name] >= 0);
						if (filesizes[name] == 0)
							delete filesizes[name];
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
						})
						.then(function() {
							// get commit info
							return self._git.catFile(commit_id);
						})
						.then(function(commit) {
							return Persist.saveCommit(self._repoName, commit_id, commit);
						});
				});
		});
	});

};


// returns array of commit ids
Digest.prototype.getRevList = function(branch_name) {
	var self = this;

	//return self._git.log(branch_name)
	return self._git.run("rev-list",
		branch_name, 
		"--first-parent",
		"--reverse")	
		.then(function(history) { // array of commits, most recent first
			history = history.split('\n')
				.filter(function(id) {
					if (id.trim().length < 40)
						return false;
					return true;
				});
			return history;
		});
}



//==============================================================================
//==============================================================================

var Readline = require('readline');
var CommitStream = require('./commit_stream.js');

Digest.prototype.buildBranchInfo2 = function(branch_name, start, max) {
	var self = this;
	start = start || 0;
	max = max || 0;

	var resolve, reject;
	var promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});

	var revCount = 0;
	var processCount = 0;

	return self.saveRevList(branch_name)
	.then(function(commit_list) {
		revCount = commit_list.length;
		return self.generateHistory(branch_name);
	})
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
			processCount ++;
			if (Persist.revisionDataExists(self._repoName, branch_name, commit.info.id)) {
				return;
			}
			if (processCount % 100 == 0) {
				status("Processing commmit", processCount, "/", revCount);
			}
			cs.pause();
			self._processingCommit = true;
			bp.pushCommit(commit)
				.then(function(){
					self._processingCommit = false;
					cs.resume();
				}).catch(function(err) {
					Logger.ERROR("PersistCommit ERROR:", err, err.stack, Logger.CHANNEL.DIGEST);
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

/* saves raw log output to file

	@revList: array of commit shas, earliest first
*/
Digest.prototype.generateHistory = function(branch_name) {
	var self = this;

	Logger.INFOHI("generateHistory()", branch_name, Logger.CHANNEL.DIGEST);

	
	return Persist.historyExists(self._repoName, branch_name)
		.then(function(exists) {
			if (!exists)
			{
				status("Generating complete diff history [git log --first-parent -p]");
				Logger.INFOHI("Calling git log", Logger.CHANNEL.DIGEST);
				var istream = new Readable;
				istream._read = function() {};
				istream.pipe(Persist.getHistoryWriteStream(self._repoName, branch_name));
				return self._git.stream(istream,
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
	Logger.ASSERT(commit.info.id && commit.info.id.length == 40);
	if (commit.diff != null) {
		return self.persistCommit(commit);
	} else {
		var parent = "";
		if (self._commitIds.length > 0) {
			parent = self._commitIds[self._commitIds.length-1];
		}
		Logger.DEBUG("Generating merge diff", 
			commit.info.id, 
			"parent",
			parent,
			Logger.CHANNEL.DIGEST);

		return self._git.diff(parent, commit.info.id)
			.then(function(diff) {
				commit.diff = diff;
				return self.persistCommit(commit);
			});
	}
};

BranchProcessor.prototype.persistCommit = function(commit) {
	var self = this;
	Logger.ASSERT(commit.info.id && commit.info.id.length == 40);

	self._count++;
	self._commitIds.push(commit.info.id);

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
					commit.info.id,
					Logger.CHANNEL.DIGEST);
			}
			Logger.ASSERT(self._filesizes[name] >=0 );
			if (self._filesizes[name] == 0) {
				delete self._filesizes[name];
			}
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

	return Persist.saveCommit(self._repoName, 
		commit.info.id, 
		commit.info
	).then(function() {

		return Persist.saveDiff(
			self._repoName, 
			commit.info.id, 
			commit.diff ? commit.diff.toString() : "", 
			summary
			).then(function() {
				// save filesizes
				return Persist.saveFileSizeSnapshot(
					self._repoName, 
					commit.info.id, 
					filesizes);
			});
	}).then(function() {
		if (VALIDATE_SIZE) {
			return self._git.diff("", commit.info.id)
				.then(function(diff) {
					Object.keys(filesizes).forEach(function(filename) {
						var summary = diff.summary(filename);
						if (!summary.length)
							summary = ["-0,0", "+1,0"];
						if (summary[1] !=
						 		("+1," + filesizes[filename])) {
						 	Logger.WARN("Bad filesize", 
						 		filename,
						 		filesizes[filename] + " != " + JSON.stringify(summary),
						 		"commit " + count,
						 		commit.info.id,
						 		Logger.CHANNEL.DIGEST
						 		);
						 	//console.log(diff.diffSummary());
						}
						Logger.ASSERT(summary[1] ===
						 ("+1," + filesizes[filename]));
					});
				});
			}
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
	console.log.apply(console, arguments);
};

module.exports = Digest;
