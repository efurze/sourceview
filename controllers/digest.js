'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Types = require('./types.js');
var Util = require('./git_util.js');
var Git = require('./git.js');
var Persist = require('./persist.js');
var Resolve = require('path').resolve;
var Logger = require('../lib/logger.js');
var Diff = require('./types/diff.js');

var Digest = function(path) {
	path = Resolve(path);
	var parts = path.split('/');
	this._repoName = parts[parts.length-1];

	this._git = new Git(path);
	this._util = new Util(this._git);
	this._persist = new Persist(this._repoName);
};

Digest.prototype.buildBranchInfo = function(branch_name) {
	var self = this;
	self.getRevisionHistory(branch_name)
		.then(function(history) {
			var max = Math.min(history.length, 100);
			history = history.slice(0, max);
			history.reverse();
			return self.crawlHistory(branch_name, history);
		});
}

Digest.prototype.crawlHistory = function(branch_name, history) { // eg 'master'
	var self = this;
	var filesizes = {
		'commits': [],
		'sizes': {} // filename: array of sizes
	};

	/*
	{
		id: <commit_sha>,
		data: {
			<filename>: summary_ary
		}
	}
	*/

	status("Building initial diff");
	return Promise.each(history, function(commit_id, index) {
		var previous = index > 0 ? history[index-1] 
		: '4b825dc642cb6eb9a060e54bf8d69288fbee4904' // null tree

		status("Calculating diff for commit", commit_id);
		return self._git.diff(previous, commit_id)
			.then(function(diff) {

				// filesize updates
				diff.filenames().forEach(function(name) {
					if (!filesizes.sizes.hasOwnProperty(name)) {
						var ary = new Array(filesizes.commits.length);
						ary.fill(0);
						filesizes.sizes[name] = ary;
					}
					var size_ary = filesizes.sizes[name];
					var previous_size = size_ary.length > 0 
						? size_ary[size_ary.length-1]
					 	: 0;
					size_ary.push(previous_size + diff.delta(name));
					
				});
				filesizes.commits.push(commit_id);
				Object.keys(filesizes.sizes).forEach(function(name) {
					var size_ary = filesizes.sizes[name];
					if (size_ary.length < filesizes.commits.length) {
						size_ary.push(size_ary[size_ary.length-1]);	
					}
				});

				// diff summary
				var summary = {}; // filename: summary_ary
				diff.filenames().forEach(function(name) {
					summary[name] = diff.summary(name);
				});

				status("Calculated diff for commit", index, "/", history.length);

				// save diff
				return self._persist.saveDiff(commit_id, diff.toString(), summary);
			});
	}).then(function() {
		//return self._persist.saveFileSizeHistory(branch_name, filesizes);
	});

};


// returns array of commit ids
Digest.prototype.getRevisionHistory = function(branch_name) {
	var self = this;
	status("Building revision history for", branch_name);
	return self._git.revList(branch_name)
		.then(function(history) { // array of commits, most recent first
			status("Persisting revision history");
			return self._persist.saveRevisionHistory(branch_name, history)
				.then(function() {
					return history;
				});
		});
};

Digest.prototype.buildDiffHistory = function(branch) {
	var self = this;
	status("Building diff history");
	return self.diffHistory(branch)
		.then(function(history) {
			status("Persisting diff history");
			return self._persist.saveDiffHistory(branch, history);
		});
}


Digest.prototype.saveSizeRange = function(branch_name, file_size_history) {
	var self = this;
	var max = {};
	file_size_history.forEach(function(file_sizes) {
		Object.keys(file_sizes.tree).forEach(function(filename) {
			var current = max[filename] || 0;
			if (current <= file_sizes.tree[filename]) {
				max[filename] = file_sizes.tree[filename];
			}
		});
	});

	return self._persist.saveFileSizeRange(branch_name, max);
};

/*
	@files = {'foo.txt': 423, 'bar/foo.txt': 43}
*/
Digest.prototype._updateFileSizes = function(files, diff) {
	Logger.DEBUGHI(files, Logger.CHANNEL.REPO);
	files = Clone(files);
	diff.filenames().forEach(function(filename) {
		if (!files.hasOwnProperty(filename)) {
			files[filename] = 0;
		}
		files[filename] = files[filename] + diff.delta(filename);
	});
	Logger.DEBUG("Updated filesizes", JSON.stringify(files), Logger.CHANNEL.REPO);
	return files;
};



// returns hash of: {filepath => filelength}
Digest.prototype.fileSizesForRevision = function(commit_id) {
	status("Building initial tree");
	Logger.DEBUG("fileSizesForRevision", commit_id, Logger.CHANNEL.REPO);
	var self = this;
	return self._git.commitStat(commit_id);
};


/*
	returns: [
		// commit 1:
		{
			commit: <commit object>
			diffs: diff object
		},
		// commit 2:
		{
			commit: <commit object>
			diffs: diff object
		},
	]
*/
Digest.prototype.diffHistory = function(branch_name) { // eg 'master'
	var self = this;
	return self._util.revWalk(branch_name)
		.then(function(history) { // array of commits
			status("Creating diff history for", history.length, "revisions");
			return Promise.mapSeries(history, function(commit, index) {
				status("Diff for revision", index + " / " + history.length);
				Logger.INFO("Diff for commit", commit.id, Logger.CHANNEL.REPO);
				return (function() {
					if (index == history.length-1) {
						Logger.INFO("Constructing first diff", Logger.CHANNEL.REPO);
						if (self._initialTrees.hasOwnProperty(branch_name)) {
							Logger.INFO("Initial tree already built", Logger.CHANNEL.REPO);
							return Promise.resolve(new Diff(self._initialTrees[branch_name]));
						} else {
							return self._persist.getFileSizeHistory(branch_name)
								.then(function(filesize_history) {
									if (filesize_history && filesize_history.length > 0) {
										Logger.INFO("Got initial tree from persist", 
											Logger.CHANNEL.REPO);
										return new Diff(filesize_history[0].tree);
									} else {
										Logger.INFO("Constructing first diff from show()", 
											Logger.CHANNEL.REPO);
										return self._util.show(commit.id);
									}
								});
						}
					} else {
						return self._git.diff(history[index+1].id, commit.id);
					}
				})().then(function(diff) {
					delete commit.parents;
					return {
						"commit": commit,
						"diffs": diff
					};
				});
			});
		});
};



//=========================================

/*
	returns: {
		'foo': <SHA-1>,
		'bar/foo': <SHA-1>, ...
	}
*/
var getAllFileIds = function(tree, path) {
	var self = this;
	var files = {};
	if (path && path.length) {
		path += "/";
	} else {
		path = "";
	}

	tree.children.forEach(function(child) {
		if (child instanceof Node) {
			var subtree = getAllFileIds(child, path+child.name);
			Object.keys(subtree).forEach(function(filename) {
				files[filename] = subtree[filename];
			});
		} else {
			files[path + child.name] = child.id;
		}
	});

	return files;
};

var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Digest;
