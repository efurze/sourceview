var path = require('path');
var fs = require('fs');
var Logger = require('./logger.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);

var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var s3 = new AWS.S3();
Promise.promisifyAll(s3);


var DATA_DIR = './data';

var REVISION_FILE = 'commithistory.json';
var HISTORY_DUMP = 'history.dat';

var BUCKET_PREFIX = 'gitscape-';

function branch_history_key(branch) {
	return "branches/" + branch;
}

function size_key(sha) {
	return "sizes/" + sha;
}

function ensure_all_dirs(repo) {

}

var OPEN_FILE_COUNT=0;

function writeFile(repo, key, data) {
	console.log('writeFile', key);
	const params = {
		'Bucket': BUCKET_PREFIX + repo,
		'Key': key,
		'Body': new Buffer(data)
	};

	return s3.putObjectAsync(params)
		.catch(function(err) {
			Logger.WARN("writeFile ERROR", 
				err.toString(),  
				Logger.CHANNEL.PERSIST);
		});
}




function readFile(repo, key) {
	console.log("readFile", key);
	const params = {
		'Bucket': BUCKET_PREFIX + repo,
		'Key': key
	};

	return s3.getObjectAsync(params)
		.then(function(data) {
			return String(data.Body);
		}).catch(function(err) {
			Logger.WARN("readFile ERROR", 
				err.toString(),  
				repo,
				key,
				Logger.CHANNEL.PERSIST);
		});
}

var Persist = function() {}


Persist.prototype.revisionDataExists = function(repo, branch, commit_sha) {
	return false;
};

Persist.prototype.commitExists = function(repo, branch, commit_sha) {
	return false;
};

Persist.prototype.diffExists = function(repo, branch, commit_sha) {
	return false;
};

Persist.prototype.sizeExists = function(repo, branch, commit_sha) {
	return false;
};

Persist.prototype.historyExists = function(repo, branch) {
	return false;
};


Persist.prototype.saveRevisionHistory = function(repo, branch, history) {
	return writeFile(repo, branch_history_key(branch), JSON.stringify(history));
};

/*
Persist.prototype.saveAllCommitData = function(repo, id, commit, diffstr, summary, sizes) {
	var data = {
		commit: commit,
		diff_summary: summary,
		sizes: sizes
	};
	return writeFile(repo, id, JSON.stringify(data))
		.then(writeFile(repo, id+"-diff", JSON.stringify(diffstr)));
}
*/

Persist.prototype.saveAllCommitData = function(repo, id, commit, diffstr, summary, sizes) {
	var self = this;
	var data = {
		commit: commit,
		diff_summary: summary
	};
	return writeFile(repo, id, JSON.stringify(data))
		.then(function () {
			return writeFile(repo, id+"-diff", JSON.stringify(diffstr));
		}).then(function() {
			var trie;
			Object.keys(sizes).forEach(function(name) {
				trie = self._addFileToTrie(name, sizes[name], trie);
			});
			return writeFile(repo, size_key(id), JSON.stringify(trie));
		});
}



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
Persist.prototype.getRevList = function(repo, branch) {
	branch = branch || 'master';
	return readFile(repo, branch_history_key(branch))
		.then(function(data) {
			return JSON.parse(data);
		}).catch(function(err) {
			Logger.WARN("getRevList ERROR", 
			err.toString(), 
			Logger.CHANNEL.PERSIST);
		});
};

/*
	returns {
		commit:
		diff_summary: {}
	}
*/
Persist.prototype.getCommitData = function(repo, id) {
	var self = this;
	return readFile(repo, id)
		.then(function(data) {
			return JSON.parse(data);
		}).catch(function(err) {
			Logger.WARN("getCommitData ERROR", 
			err.toString(), 
			Logger.CHANNEL.PERSIST);
		});
};

/*
	returns {
		<sha>: {}
	}
*/
Persist.prototype.sizeTree = function(repo, id) {
	var self = this;
	return readFile(repo, size_key(id))
		.then(function(data) {
			const parsed = JSON.parse(data);
			const ret = {};
			ret[id] = parsed;
			return ret;
		});
}


Persist.prototype.getDiff = function(repo, id) {
	return "";
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
Persist.prototype._flattenTree = function(tree, outHash, path) {
	var self = this;
	path = path || '/';
	Object.keys(tree.children).forEach(function(name) {
		var newPath = path + name;
		if (typeof(tree.children[name]) == 'object') {
			// subdir
			self._flattenTree(tree.children[name], outHash, newPath + '/');
		} else {
			outHash[newPath] = tree.children[name];
		}
	});
}

Persist.prototype._addFileToTrie = function(path, size, trie) {
	var self = this;
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
		trie.children[dir_name] = self._addFileToTrie(path.slice(index+1), 
			size, 
			trie.children[dir_name]);
	}
	return trie;
}



module.exports = Persist;