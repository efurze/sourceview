var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
Promise.promisifyAll(fs);


var DATA_DIR = './model/data';

var REVISION_FILE = 'commithistory.json';
var HISTORY_DUMP = 'history.dat';

var COMMIT_DIR = "commits";
var DIFF_DIR = "diffs";
var DIFF_SUMMARY_DIR = "diff_summaries";
var SIZE_DIR = "sizes";

function dir(repo) {
	return DATA_DIR + '/' + repo;
}

function commit_dir(repo) {
	return dir(repo) + '/' + COMMIT_DIR;
}

function diff_dir(repo) {
	return dir(repo) + '/' + DIFF_DIR;
}

function summary_dir(repo) {
	return dir(repo) + '/' + DIFF_SUMMARY_DIR;
}

function size_dir(repo) {
	return dir(repo) + '/' + SIZE_DIR;
}

function ensure_dir(dir) {
	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
    }
}

function ensure_all_dirs(repo) {
	ensure_dir(dir(repo));
	ensure_dir(commit_dir(repo));
	ensure_dir(diff_dir(repo));
	ensure_dir(summary_dir(repo));
	ensure_dir(size_dir(repo));
}

var Persist = {

	revisionDataExists: function(repo, branch, commit_sha) {
		return Persist.commitExists(repo, branch, commit_sha)
		&& Persist.diffExists(repo, branch, commit_sha)
		&& Persist.sizeExists(repo, branch, commit_sha);
	},

	commitExists: function(repo, branch, commit_sha) {
		var filename = commit_dir(repo) + '/' + commit_sha;
		return fs.existsSync(filename);
	},

	diffExists: function(repo, branch, commit_sha) {
		var filename = diff_dir(repo) + '/' + commit_sha;
		var summary = summary_dir(repo) + '/' + commit_sha;
		return fs.existsSync(filename) && fs.existsSync(summary);
	},

	sizeExists: function(repo, branch, commit_sha) {
		var filename = size_dir(repo) + '/' + commit_sha;
		return fs.existsSync(filename);
	},

	historyExists: function(repo, branch) {
		var filename = dir(repo) + '/' + branch + '.' + HISTORY_DUMP;
		return fs.accessAsync(filename)
			.then(function(err) {
				if (err && err.code === "ENOENT") {
					return false;
				} else {
					return true;
				}
			}).catch(function(err) {
				return false;
			});
	},

	getHistoryReadStream: function(repo, branch) {
		ensure_all_dirs(repo);
		var filename = dir(repo) + '/' + branch + '.' + HISTORY_DUMP;
		return fs.createReadStream(filename);
	},

	getHistoryWriteStream: function(repo, branch) {
		ensure_all_dirs(repo);
		var filename = dir(repo) + '/' + branch + '.' + HISTORY_DUMP;
		return fs.createWriteStream(filename);
	},

	saveRevisionHistory: function(repo, branch, history) {
		ensure_all_dirs(repo)
		var filename = dir(repo) + "/" + branch + "." + REVISION_FILE;
		return fs.writeFileAsync(filename, JSON.stringify(history));
	},

	saveCommit: function(repo, id, commit) {
		ensure_all_dirs(repo);
		var self = this;
		var filename = commit_dir(repo) + '/' + id;
		return fs.writeFileAsync(filename, JSON.stringify(commit));
	},

	saveDiff: function(repo, id, diffstr, summary) {
		ensure_all_dirs(repo)
		var self = this;
		var filename = diff_dir(repo) + '/' + id;
		return fs.writeFileAsync(filename, diffstr)
			.then(function() {
				return fs.writeFileAsync(summary_dir(repo) + '/' + id, JSON.stringify(summary));
			});
	},

	saveFileSizeSnapshot: function(repo, commit_id, sizes) {
		ensure_all_dirs(repo)
		var filename = size_dir(repo) + '/' + commit_id;
		var trie = {};
		Object.keys(sizes).forEach(function(name) {
			addFileToTrie(name, sizes[name], trie);
		});
		return fs.writeFileAsync(filename, JSON.stringify(trie));
	},


/*
returns: [
		{
			hash: <sha>,
			date:
			message:
			author_name:
			author_email:
		},
		...
	]
*/
	getRevList: function(repo, branch) {
		branch = branch || 'master';
		var dir = DATA_DIR + '/' + repo;
		return fs.readFileAsync(dir + '/' + branch + "." + REVISION_FILE)
			.then(function(data) {
				return JSON.parse(data);
			});
	},

	getCommit: function(repo, id) {
		var self = this;
		var filename = commit_dir(repo) + '/' + id;
		return fs.readFileAsync(filename)
			.then(function(data) {
				return JSON.parse(data);
			});
	},

/*
returns: {
		commit_id: {
			filename: ["-0,0", "+1, 23"],
			...
		}
		...
	}
*/
	diffSummary: function(repo, commit_list) {
		var dir = DATA_DIR + '/' + repo;
		var summaries = {};
		return Promise.each(commit_list, function(commit, index) {
			//console.log(index);
			var id = commit.id;
			return fs.readFileAsync(dir + '/diff_summaries/' + id)
				.then(function(summary) {
					summaries[id] = JSON.parse(summary);
				});
		}).then(function() {
			return summaries;
		});
	},

/*
returns: {
		commit_id: {
			filename: length,
			...
		}
		...
	}
*/
	sizeTree: function(repo, commit_list) {
		var dir = DATA_DIR + '/' + repo;
		var sizes = {};
		return Promise.each(commit_list, function(commit, index) {
			//console.log(index);
			var id = commit.id;
			return fs.readFileAsync(dir + '/sizes/' + id)
				.then(function(size) {
					sizes[id] = JSON.parse(size);
				});
		}).then(function() {
			return sizes;
		});
	},

	sizeSnapshot: function(repo, commit_list) {
		return Persist.sizeTree(repo, commit_list)
			.then(function(sizes) {
				var ret = {};
				Object.keys(sizes).forEach(function(commit) {
					var hash = {};
					flattenTree(sizes[commit], hash);
					ret[commit] = hash;
				});
				return ret;
			});
	}

};

/*
{
	"Gruntfile.js":84,
	"README.md":1,
	"index.js":104,
	"package.json":46,
	"views": 
	{
		"index.hbs":48,
		"layouts":
			{
				"single.hbs":8
			}
	}
}
*/
var flattenTree = function(tree, outHash, path) {
	path = path || '';
	Object.keys(tree).forEach(function(name) {
		var newPath = path + name;
		if (typeof(tree[name]) == 'object') {
			// subdir
			flattenTree(tree[name], outHash, newPath + '/');
		} else {
			outHash[newPath] = tree[name];
		}
	});
}

var addFileToTrie = function(path, size, obj) {
	obj = obj || {};
	var index = path.indexOf('/');
	if (index < 0) {
		obj[path] = size;
	} else {
		var dir_name = path.slice(0, index);
		var dir = obj[dir_name] || {};
		addFileToTrie(path.slice(index+1), size, dir);
		obj[dir_name] = dir;
	}
}



module.exports = Persist;