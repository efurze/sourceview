'use strict'
var fs = require('fs');
var Promise = require('bluebird');
var Types = require('./types.js');
var Util = require('./git_util.js');
var Git = require('./git.js');
var Persist = require('./persist.js');

var Repo = function(path) {
	this._git = new Git(path);
	this._util = new Util(this._git);
	this._persist = new Persist();
};

Repo.prototype.buildCommitHistory = function(branch) {
	var self = this;
	return self.fileSizeHistory(branch) 
		.then(function(history) {
			return self._persist.saveFileSizeHistory(branch, history)
				.then(function() {
					return self.saveSizeRange(branch, history);
				});
		}).then(function() {
			return self.diffHistory(branch);
		}).then(function(history) {
			return self._persist.saveDiffHistory(branch, history);
		});
};


Repo.prototype.saveSizeRange = function(branch_name, file_size_history) {
	var self = this;
	var max = {};
	file_size_history.forEach(function(file_sizes) {
		Object.keys(file_sizes.tree).forEach(function(filename) {
			var current = max[filename] || 0;
			if (current < file_sizes.tree[filename]) {
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
	return self._util.revWalk(branch_name)
		.then(function(history) { // array of commits

			var current_rev = history.pop();
			var initial_commit = current_rev.id;

			return self._util.buildTree(current_rev.tree)
				.then(getAllFileIds)
				.then(function(files) { // {filepath => sha1}
					return Promise.each(Object.keys(files), function(filepath) {
						return self._git.catFile(files[filepath])
							.then(function(filedata) {
								files[filepath] = filedata.length;
							});
					}).then(function() {
						return files;
					});
				}).then(function(files) { // {filepath => filelength}
					var initial_files = Clone(files); // for first rev
					return Promise.mapSeries(history, function(rev) {
						return self._git.diff(current_rev.tree, rev.tree)
							.then(function(diff) {
								current_rev = rev;
								files = self._updateFileSizes(files, diff);
								return {
									'commit': rev.id,
									'tree': files
								}
							});
					}).then(function(file_history) {
						file_history.push({
							'commit': initial_commit,
							'tree': initial_files
						});
						return file_history;
					});
				});
		});
};




Repo.prototype.diffHistory = function(branch_name) { // eg 'master'
	var self = this;
	return self._util.revWalk(branch_name)
		.then(function(history) { // array of commits
			return Promise.map(history, function(commit) {
				return self._git.diff(commit.id)
					.then(function(diff) {
						return diff._summary;
					});
			});
		});
};

/*
	@files = {'foo.txt': 423, 'bar/foo.txt': 43}
*/
Repo.prototype._updateFileSizes = function(files, diff) {
	files = Clone(files);
	diff = diff.parse_diff();
	diff.forEach(function(filediff) {
		var filename = filediff.from;
		var delta = parseInt(filediff.additions) - parseInt(filediff.deletions);
		if (!filename || filename === "/dev/null") {
			// file created
			filename = filediff.to;
			files[filename] = delta;
		} else if (filediff.to === "/dev/null") {
			// file deleted
			files[filename] = 0;
		} else if (filediff.from !== filediff.to) {
			// file renamed
			files[filediff.from] = 0;
			files[filediff.to] = delta;
		} else {
			files[filename] = files[filename] + delta;
		}
	});
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
			var subtree = getAllFileIds(child, child.name);
			Object.keys(subtree).forEach(function(filename) {
				files[filename] = subtree[filename];
			});
		} else {
			files[path + child.name] = child.id;
		}
	});

	return files;
};

module.exports = Repo;