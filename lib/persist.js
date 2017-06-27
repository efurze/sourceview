var path = require('path');
var fs = require('fs');
var Logger = require('./logger.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);


var DATA_DIR = './data';

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
	ensure_dir(DATA_DIR);
	ensure_dir(dir(repo));
	ensure_dir(commit_dir(repo));
	ensure_dir(diff_dir(repo));
	ensure_dir(summary_dir(repo));
	ensure_dir(size_dir(repo));
}

let OPEN_FILE_COUNT=0;

function writeFile(file, data, retry_count) {
	retry_count = retry_count || 0;
	return fs.openAsync(file, 'w')
		.then(function(fd) {
			OPEN_FILE_COUNT++;
			return fs.writeFileAsync(fd, data)
				.then(function() {
					return fs.closeAsync(fd);
				});
		}).then(function() {
			OPEN_FILE_COUNT--;
			return;
		}).catch(function(err) {
			Logger.WARN("writeFile ERROR", 
				err.toString(), 
				"OpenFileCount:", 
				OPEN_FILE_COUNT, 
				Logger.CHANNEL.PERSIST);
			if (retry_count < 3) {
				return writeFile(file, data, retry_count+1);
			} else {
				return Promise.reject("writeFile exceeded retry count");
			}
		});
}


function readFile(filename, retry_count) {
	retry_count = retry_count || 0;
	let data, fd;
	return fs.openAsync(filename, 'r')
		.then(function(f) {
			fd = f;
			OPEN_FILE_COUNT++;
			return fs.readFileAsync(fd);
		}).then(function(d) {
			data = d;
			return fs.closeAsync(fd);
		}).then(function() {
			OPEN_FILE_COUNT--;
			return data;
		}).catch(function(err) {
			Logger.WARN("readFile ERROR", 
				err.toString(), 
				"OpenFileCount:", 
				OPEN_FILE_COUNT, 
				Logger.CHANNEL.PERSIST);
			if (retry_count < 3) {
				return readFile(filename, retry_count+1);
			} else {
				return Promise.reject("readFile exceeded retry count");
			}
		});
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
		return writeFile(filename, JSON.stringify(history));
	},

	saveCommit: function(repo, id, commit) {
		ensure_all_dirs(repo);
		var self = this;
		var filename = commit_dir(repo) + '/' + id;
		return writeFile(filename, JSON.stringify(commit));
	},

	saveDiff: function(repo, id, diffstr, summary) {
		ensure_all_dirs(repo)
		var self = this;
		var filename = diff_dir(repo) + '/' + id;
		return writeFile(filename, diffstr)
			.then(function() {
				return writeFile(summary_dir(repo) + '/' + id, JSON.stringify(summary));
			});
	},

	saveFileSizeSnapshot: function(repo, commit_id, sizes) {
		ensure_all_dirs(repo)
		var filename = size_dir(repo) + '/' + commit_id;
		var trie;
		Object.keys(sizes).forEach(function(name) {
			trie = addFileToTrie(name, sizes[name], trie);
		});
		return writeFile(filename, JSON.stringify(trie));
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
		return readFile(dir + '/' + branch + "." + REVISION_FILE)
			.then(function(data) {
				return JSON.parse(data);
			});
	},

	getCommit: function(repo, id) {
		var self = this;
		var filename = commit_dir(repo) + '/' + id;
		return readFile(filename)
			.then(function(data) {
				return JSON.parse(data);
			});
	},

	getDiff: function(repo, id) {
		var self = this;
		var filename = diff_dir(repo) + '/' + id;
		return readFile(filename)
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
			return readFile(dir + '/diff_summaries/' + id)
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
			return readFile(dir + '/sizes/' + id)
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
	path = path || '/';
	Object.keys(tree.children).forEach(function(name) {
		var newPath = path + name;
		if (typeof(tree.children[name]) == 'object') {
			// subdir
			flattenTree(tree.children[name], outHash, newPath + '/');
		} else {
			outHash[newPath] = tree.children[name];
		}
	});
}

var addFileToTrie = function(path, size, trie) {
	trie = trie || {
		size: 0,
		files: 0,
		subdir_count: 0,
		children: {}
	};
	if (path.charAt(0) == '/')
		path = path.slice(1);
		trie.files ++;
	var index = path.indexOf('/');
	if (index < 0) {
		// file
		trie.children[path] = size;
		trie.size += size;
	} else {
		// dir
		var dir_name = path.slice(0, index);
		if (!trie.children.hasOwnProperty(dir_name)) {
			trie.subdir_count ++;
		}
		trie.children[dir_name] = addFileToTrie(path.slice(index+1), 
			size, 
			trie.children[dir_name]);
	}
	return trie;
}



module.exports = Persist;