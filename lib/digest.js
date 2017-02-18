'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Git = require('./git.js');
var Persist = require('./persist.js');
var Resolve = require('path').resolve;
var Logger = require('./logger.js');
var Diff = require('./types/diff.js');
var Readline = require('readline');
var Spawn = require('./spawn.js');

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


Digest.prototype.buildBranchInfo2 = function(branch_name, start, max) {
	var self = this;

	return self.generateHistory(branch_name)
	.then(function() {
		return self.readHistory(branch_name);
	}).then(function(history) {
	//return self.readHistory(branch_name)
	//.then(function(history) {
		/*
		status("Generating merge diffs");
		var merges = [];
		for (var i=0; i < history.length; i++) {
			if (!history[i].diff) {
				merges.push({
					id: history[i].info.hash,
					parent: i > 0 ? history[i-1].info.hash : ""
				});
			}
		}
		console.log("MERGES:", merges.length);
		*/
		return history;
	}).then(function(history) {
		status("Persisting revision history");
		history.reverse();
		return Persist.saveRevisionHistory(
			self._repoName, 
			branch_name, 
			history.map(function(commit) {
				Logger.ASSERT(commit.info.hash && commit.info.hash.length == 40);
				return commit.info.hash;
			})).then(function() {
				return Promise.each(history, function(commit, index) {
					if ((index+1) % 100 == 0)
						status("Saving commit metadata", index+1, "/", history.length);
					return Persist.saveCommit(self._repoName, 
						commit.info.hash, 
						commit.info);
				});
			}).then(function() {
				var filesizes = {}; // filename: size
				return Promise.each(history, function(commit, index) {
					
					var summary = {}; // filename: summary_ary

					// filesize updates
					if (commit.diff) {
						commit.diff.filenames().forEach(function(name) {
							if (!filesizes.hasOwnProperty(name)) {
								filesizes[name] = 0;
							}
							filesizes[name] = filesizes[name] + commit.diff.delta(name);
							Logger.ASSERT(filesizes[name] >=0 );
						});

						// diff summary
						
						commit.diff.filenames().forEach(function(name) {
							summary[name] = commit.diff.summary(name);
						});
					}
					
					if ((index+1) % 100 == 0)
						status("Saving diff", index+1, "/", history.length, commit.info.hash);
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
			});
	});

};



Digest.prototype.generateHistory = function(branch_name) {
	var self = this;
	
	var spawn = new Spawn();
	var istream = spawn.getStream();
	istream.pipe(Persist.getHistoryWriteStream(self._repoName, branch_name));
	return spawn.run("git", 
		"--git-dir=" + self._path + "/.git",
		"log", 
		"--first-parent",
		"-p");
}


/*
returns [{
	info: {
		hash: "",
		author_name: "",
		author_email: "",
		date: "",
		message: ""
	},
	diff: Diff
},...];
*/
Digest.prototype.readHistory = function(branch_name) {
	var self = this;

	var promise, resolve, reject;
	promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});
	

	var istream = Persist.getHistoryReadStream(self._repoName, branch_name);
	var rl = Readline.createInterface({
		input: istream
	});
	//b51ad4314078298194d23d46e2b4473ffd32a88a

	var firstOne = true;
	var inCommitHeader = false;
	var readingDiff = false;
	var diff_str = "";
	var commit_header = "";
	var commits = [];
	var commit;
	rl.on('line', function(line) {
		line += '\n';
		if (line.startsWith("commit ")) {
			inCommitHeader = true;
			readingDiff = false;
			if (!firstOne) {
				Logger.ASSERT(commit_header.length);
				commit.info = parseCommitHeader(commit_header);
				Logger.ASSERT(commit.info.hash);
				commit_header = "";
				if (diff_str && diff_str.trim().length) {
					commit.diff = new Diff(diff_str);
				} else {
					commit.diff = null;
				}
				diff_str = "";
				commits.push(commit);
				if (commits.length % 100 == 0)
					status("Read commit", commits.length);
			}
			firstOne = false;

			commit = {
				info: {},
				diff: {}
			};
			commit_header = line;
		} else if (line.startsWith("diff --git")){
			if (inCommitHeader) {
				inCommitHeader = false;
				readingDiff = true;
				diff_str = "";
			}
			diff_str += line;
		} else if (inCommitHeader) {
			commit_header += line;
		} else if (readingDiff) {
			diff_str += line;
		}
	});

	rl.on('close', function() {
		if (readingDiff) {
			commit.info = parseCommitHeader(commit_header);
			commit.diff = new Diff(diff_str);
			Logger.ASSERT(commit.diff && commit.info.hash);
			commits.push(commit);
		}
		console.log("Found", commits.length, "commits");
		resolve(commits);
	});


	return promise;
}



/*
@header = 
'commit a95b74d50734f36458cef910edc7badf38b49fec
Author: Eric Furze <efurze@yahoo-inc.com>
Date:   Fri Jan 20 23:33:21 2017 -0800

    Initial commit

'
*/
function parseCommitHeader(header) {
	var lines = header.split('\n');
	var parsed = {
		hash: "",
		author_name: "",
		author_email: "",
		date: "",
		message: ""
	};
	var parts;
	lines.forEach(function(line) {
		if (line.startsWith('commit ')) {
			parts = line.split(' ');
			parsed.hash = parts[1];
			Logger.ASSERT(parsed.hash.length == 40);
		} else if (line.startsWith('Author: ')) {
			var match = "Author: ";
			line = line.substr(line.indexOf(match) + match.length);
			var open = line.lastIndexOf('<');
			var close = line.lastIndexOf('>');
			parsed.author_name = line.substr(0, open-1).trim();
			parsed.author_email = line.substring(open+1, close);
		} else if (line.startsWith('Date: ')) {
			var tag = "Date: ";
			parsed.date = line.substr(line.indexOf(tag)+tag.length).trim();
		} else if (line.trim().length > 0){
			parsed.message += line.trim() + '\n';
		}
	});

	Logger.ASSERT(parsed.hash && parsed.hash.length == 40);
	return parsed;
}



var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Digest;
