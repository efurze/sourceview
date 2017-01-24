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
		});
};

Git.prototype.diff = function(sha1, sha2) {
	var self = this;
	var args = [sha1];
	if (sha2) {
		args.push(sha2);
	}
	return self._git.diffAsync(args)
		.then(function(diffstr) {
			return new diff(diffstr);
		});
};

// @ref: SHA or branch/tag name ('master', 'HEAD', etc)
Git.prototype.revList = function(ref) {
	var self = this;
	var history = []; // ascending list of commit shas
	return self.catFile(ref)
		.then(function(commit) {
			if (commit) {
				history.push(commit.id);
				if (commit.parents && commit.parents.length) {
					// recurse
					return self.revList(commit.parents[0])
						.then(function(more_history) {
							return history.concat(more_history);
						});
				}
			}
			return history;
		});
};

module.exports = Git;