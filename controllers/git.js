var Promise = require('bluebird');
var diff = require('./types/diff.js');


var parseCatFile = function(data, type, sha) {
	var ret = {
		'id': sha
	};
	if (data) {
		if (type === 'tree') {
			ret['children'] = [];
			data.split('\n').forEach(function(line) {
				if (line && line.length) {
					var parts = line.split(/\s/);
					var info = {
						'name': parts[3],
						'id': parts[2],
						'type': parts[1]
					};
					ret['children'].push(info);
				}
			});
		} else if (type === 'commit') {
			var parents = [];
			var found_empty_line = false;
			var comment = "";
			data.split('\n').forEach(function(line) {
				if (found_empty_line) {
					if (comment.length) {
						comment += '\n';
					}
					comment += line;
				} else {
					if (line.length) {
						var parts = line.split(/\s/);
						if (parts[0].trim() === 'tree') {
							ret['tree'] = parts[1];
						} else if (parts[0].trim() === 'author') {
							ret['author'] = parts[1];
						} else if (parts[0].trim() === 'committer') {
							ret['committer'] = parts[1];
						} else if (parts[0].trim() === 'parent') {
							parents.push(parts[1]);
						}
					} else if (!found_empty_line) {
						found_empty_line = true;
					} 
				}
			});
			ret['parents'] = parents;
			ret['commit_msg'] = comment;
		} else if (type === 'blob') {
			// TODO
			ret = data.split('\n');
		}
	}
	return ret;
}

var Git = function(path) {
	var gitSync = require('simple-git')(path);
	this._git = Promise.promisifyAll(gitSync);
};


Git.prototype.catFile = function(id) {
	var self = this;
	//console.log("cat-file", id);
	var type;
	return self._git.revparseAsync([id])
		.then(function(sha) {
			if (!sha) {
				sha = id;
			}
			sha = sha.trim();
			return self._git.catFileAsync(['-t', sha])
				.then(function(obj_type) {
					type = obj_type.trim();
					return self._git.catFileAsync(['-p', sha]);
				}).then(function(data) {
					return parseCatFile(data, type, sha);
				});
		}).catch(function(err) {
			console.log("catFile error", err.toString());
			return null;
		});
};


Git.prototype.diff = function(sha1, sha2) {
	var self = this;
	var args = [sha1];
	if (sha2) {
		args.push(sha2);
	}
	args.push('-U0');
	return self._git.diffAsync(args)
		.then(function(diffstr) {
			return new diff(diffstr);
		});
};

/*
	Pass in a commit id, returns filesize hash:
{
  'Gruntfile.js': 84,
  'README.md': 1,
  'controllers/git.js': 142,
  'controllers/git_util.js': 172,
  'controllers/persist.js': 76,
  'controllers/repo.js': 254,
  'controllers/types.js': 18,
  'controllers/types/diff.js': 284,
}
*/
Git.prototype.commitStat = function(commit_sha) {
	var self = this;
	var args = [];
	args.push('4b825dc642cb6eb9a060e54bf8d69288fbee4904'); // null tree
	args.push(commit_sha);
	args.push('--stat');
	return self._git.diffAsync(args)
		.then(function(stat_str) {
			let file_sizes = {};
			stat_str.split('\n').forEach(function(line) { 
				// tools/testing/nvdimm/Kbuild   |    71 +
				let parts = line.trim().split('|');
				if (parts && parts.length > 1) {
					parts[1] = parts[1].replace('+', '').trim();
					file_sizes[parts[0].trim()] = parseInt(parts[1]);
				}
			});
			return file_sizes;
		});
};


// @ref: SHA or branch/tag name ('master', 'HEAD', etc)
Git.prototype.revList = function(ref) {
	var self = this;
	var resolve, reject;
	var promise = new Promise(function (res, rej) {
		resolve = res;
		reject = rej;
	});

	history = []; // descending list of commit shas

	var doRevList = function (reference, history_ary) {
		self.catFile(reference)
			.then(function(commit) { // commit object
				if (commit) {
					history_ary.push(commit.id);
					status("Added commit #", history_ary.length, 'id:', commit.id);
				}
				if (commit && commit.parents && commit.parents.length) {
					// recurse via timer so we don't blow the stack
					setImmediate(doRevList, commit.parents[0], history_ary);
				} else {
					resolve(history_ary);
				}
			}).catch(function(err) {
				reject(err);
			});
	};

	doRevList(ref, history);

	return promise;
};

var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Git;