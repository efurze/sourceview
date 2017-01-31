'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Types = require('./types.js');
var Util = require('./git_util.js');
var Git = require('./git.js');
var Persist = require('./persist.js');
var Resolve = require('path').resolve;
var Logger = require('../lib/logger.js');

var Repo = function(path) {
	path = Resolve(path);
	var parts = path.split('/');
	this._repoName = parts[parts.length-1];

	this._git = new Git(path);
	this._util = new Util(this._git);
	this._persist = new Persist(this._repoName);
	this._initialTrees = {}; // branchname => filesize hash of initial commit
};

Repo.prototype.buildCommitHistory = function(branch) {
	var self = this;
	return self.fileSizeHistory(branch) 
		.then(function(history) {
			return self._persist.saveFileSizeHistory(branch, history)
				.then(function() {
					status("Persisting fileSizeHistory");
					return self.saveSizeRange(branch, history);
				});
		}).then(function() {
			self.buildDiffHistory(branch);
		});
};

Repo.prototype.buildDiffHistory = function(branch) {
	var self = this;
	status("Building diff history");
	return self.diffHistory(branch)
		.then(function(history) {
			status("Persisting diff history");
			return self._persist.saveDiffHistory(branch, history);
		});
}


Repo.prototype.saveSizeRange = function(branch_name, file_size_history) {
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
	returns promise that resolves to:
	[
		{
			id: <commit sha>,
			tree: {
				"foo.txt": 34,
				"bar.txt": 49,
				"foo/bar.txt": 349
			}
		}
	]

	Each array element is a revision, element 0 is latest rev.
	Object contains full path name of every file in tree with corresponding
	file length (in lines)
*/
Repo.prototype.fileSizeHistory = function(branch_name) { // eg 'master'
	var self = this;
	status("Building revision history for", branch_name);
	return self._util.revWalk(branch_name)
		.then(function(history) { // array of commits, most recent first
			status("Creating FizeSizeHistory for", history.length, "revisions");
			Logger.INFO("revList", JSON.stringify(history), Logger.CHANNEL.REPO);
			var current_rev = history.pop();
			var initial_commit = current_rev.id;
			history.reverse();

			return self.fileSizesForRevision(current_rev.tree)
				.then(function(files) { // {filepath => filelength}
					status("Building diff history");
					var initial_files = Clone(files); // for first rev
					Logger.INFO("Initial file sizes", JSON.stringify(initial_files), Logger.CHANNEL.REPO);
					self._initialTrees[branch_name] = initial_files;
					return Promise.mapSeries(history, function(rev, index) {
						status("Revision", index + " / " + history.length);
						Logger.INFO(index, rev.id, rev.commit_msg, Logger.CHANNEL.REPO);
						Logger.INFO("diffing", current_rev.id, rev.id, Logger.CHANNEL.REPO);
						return self._git.diff(current_rev.id, rev.id)
							.then(function(diff) {
								current_rev = rev;
								files = self._updateFileSizes(files, diff);
								return {
									'commit': rev.id,
									'tree': files
								}
							});
					}).then(function(file_history) {
						file_history.reverse();
						file_history.push({
							'commit': initial_commit,
							'tree': initial_files
						});
						//Logger.INFO("Adding commit #" + file_history.length, Logger.CHANNEL.REPO);
						return file_history;
					});
				});
		});
};

// returns hash of: {filepath => filelength}
Repo.prototype.fileSizesForRevision = function(tree_id) {
	status("Building initial tree");
	var self = this;
	return self._util.buildTree(tree_id)
				.then(getAllFileIds)
				.then(function(files) { // {filepath => sha1}
					var filecount = Object.keys(files).length;
					status("Built tree. Getting file info for", filecount, "files");
					return Promise.each(Object.keys(files), function(filepath, index) {
						if (index % 100 == 0) {
							status(index + " / " + filecount);
						}
						return self._git.catFile(files[filepath])
							.then(function(filedata) {
								files[filepath] = filedata.length;
							});
					}).then(function() {
						return files;
					});
				});
};


/*
	returns: [
		// commit 1:
		{
			commit: <commit object>
			diffs: 
			{
				'file1': ["-11,2","+10,0","-66","+64","-96","+94"],
				'file2': []
			}
		},
		// commit 2:
		{
			commit: <commit object>
			diffs:
			{
				'file1': ["-11,2","+10,0","-66","+64","-96","+94"],
				'file2': []
			}
		},
	]
*/
Repo.prototype.diffHistory = function(branch_name) { // eg 'master'
	var self = this;
	return self._util.revWalk(branch_name)
		.then(function(history) { // array of commits
			status("Creating diff history for", history.length, "revisions");
			return Promise.mapSeries(history, function(commit, index) {
				status("Diff for revision", index + " / " + history.length);
				if (index < history.length-1) {
					Logger.INFO("Diffing commit", commit.id, Logger.CHANNEL.REPO);
					return self._git.diff(history[index+1].id, commit.id)
						.then(function(diff) {
							delete commit.parents;
							//Logger.INFO(JSON.stringify(diff), Logger.CHANNEL.REPO);
							let summary = {};
							diff.filenames().forEach(function(name) {
								summary[name] = diff.summary(name);
							});
							return {
								"commit": commit,
								"diffs": summary
							}
						});
				} else {
					return (function() {
							if (self._initialTrees.hasOwnProperty(branch_name)) {
								var resolve;
								var promise = new Promise(function(res) {
									resolve = res;
								});
								resolve(self._initialTrees[branch_name]);
								return promise;
							} else {
								return self.fileSizesForRevision(commit.tree);
							}
						})().then(function(initial_sizes) {
							var diffs = {};
							Object.keys(initial_sizes).forEach(function(filename) {
								diffs[filename] = ["-0,0", "+1," + initial_sizes[filename]];
							});
							return {
								"commit": commit,
								"diffs": diffs
							};
						});
				}
			}).then(function(diff_ary) {
				return diff_ary.filter(function(diff) {
					if (diff && diff.diffs) 
						return true;
					else
						return false;
				});
			});
		});
};

/*
	@files = {'foo.txt': 423, 'bar/foo.txt': 43}
*/
Repo.prototype._updateFileSizes = function(files, diff) {
	Logger.DEBUGHI(files, Logger.CHANNEL.REPO);
	files = Clone(files);
	diff.filenames().forEach(function(filename) {
		if (!files.hasOwnProperty(filename)) {
			files[filename] = 0;
		}
		files[filename] = files[filename] + diff.delta(filename);
	});
	Logger.INFO("Updated filesizes", JSON.stringify(files), Logger.CHANNEL.REPO);
	return files;
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
	var args = Array.from(arguments);
	args.push(Logger.CHANNEL.REPO);
	Logger.INFO.apply(Logger, args);
};

module.exports = Repo;