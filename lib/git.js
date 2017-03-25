var Promise = require('bluebird');
var diff = require('./types/diff.js');
var Logger = require('./logger.js');
var Spawn = require('./spawn.js');


var isEmail = function(str) {
	if (str.startsWith('<') && str.endsWith('>') && str.indexOf('@') > 0)
		return true;
	return false;
}

// author Eric Furze <efurze@yahoo-inc.com> 1489099772 -0800
var parseAuthorLine = function(line) {
	var parts = line.split(/\s/);
	var name = '';
	var email = '';
	var timestamp = '';
	var found_email = false;
	parts.forEach(function(part, index) {
		if (index == 0)
			return; // skip 'author/committer'

		if (!found_email) {
			if (isEmail(part)) {
				found_email = true;
				email = part.slice(1, part.length-1);
			} else {
				name += part + ' ';
			}
		} else {
			timestamp += part + ' ';
		}
	});

	return {
		name: name.trim(),
		email: email.trim(),
		timestamp: timestamp.trim()
	};
}

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
			/*
				tree 1318044e804f741f0ad4a652ad2c81f727fcac3f
				parent 7db69ca5261adcc524230a0fba198bcdb13d810f
				author Eric Furze <efurze@yahoo-inc.com> 1489099772 -0800
				committer Eric Furze <efurze@yahoo-inc.com> 1489099772 -0800
			*/
			var parents = [];
			var found_empty_line = false;
			var comment = "";
			var author_info;
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
							author_info = parseAuthorLine(line);
							ret['author_name'] = author_info.name;
							ret['author_email'] = author_info.email;
							ret['date'] = author_info.timestamp;							
						} else if (parts[0].trim() === 'parent') {
							parents.push(parts[1]);
						} else if (parts[0].trim() === 'committer') {
							author_info = parseAuthorLine(line);
							ret['committer'] = author_info.name;
						}
					} else if (!found_empty_line) {
						found_empty_line = true;
					} 
				}
			});
			ret['parents'] = parents;
			ret['message'] = comment;
		} else if (type === 'blob') {
			// TODO
			ret = data.split('\n');
		}
	}
	return ret;
}

var Git = function(path) {
	this._path = path;
};


Git.prototype.catFile = function(id) {
	var self = this;
	var type;
	return self.run("rev-parse",
					id)
		.then(function(sha) {
			if (!sha) {
				sha = id;
			}
			sha = sha.trim();
			return self.run(
					"cat-file",
					"-t",
					sha)
				.then(function(obj_type) {
					type = obj_type.trim();
					return self.run("cat-file",
							"-p",
							sha);
				}).then(function(data) {
					return parseCatFile(data, type, sha);
				});
		}).catch(function(err) {
			console.log("catFile error", err.toString());
			return null;
		});
}

Git.prototype.run = function() {
	var self = this;
	Array.prototype.unshift.call(arguments, null);
	return self._doRun.apply(self, arguments);
}

Git.prototype.stream = function(istream) {
	var self = this;
	return self._doRun.apply(self, arguments);
}

Git.prototype._doRun = function() {
	var self = this;
	var istream = arguments[0];
	Array.prototype.shift.call(arguments);
	if (istream) {
		console.log("streaming mode");
	}
	Array.prototype.unshift.call(arguments, "--git-dir=" + self._path + "/.git");
	Array.prototype.unshift.call(arguments, "git");

	var spawn = new Spawn(istream);
	return spawn.run.apply(spawn, arguments);
}

Git.prototype.diff = function(sha1, sha2) {
	var self = this;
	var numstat = false;
	if (!sha1 || !sha1.length) {
		sha1 = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
		numstat = true;
	}
	if (!sha2 || !sha2.length) {
		sha2 = sha1;
		sha1 = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
		numstat = true;
	}

    if (numstat) {
    	return self.run("diff", 
					sha1,
					sha2,
					"--numstat")
    		.then(function(diffstr) {
    			var d = new diff();
    			d.parseNumstat(diffstr);
    			return d;
    		});
    } else {
    	return self.run("diff", 
					sha1,
					sha2)
    		.then(function(diffstr) {
    			return new diff(diffstr);
    		});
    }
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
	Logger.DEBUG("commitStat", commit_sha, Logger.CHANNEL.GIT);
	var self = this;
	var args = [];
	args.push('4b825dc642cb6eb9a060e54bf8d69288fbee4904'); // null tree
	args.push(commit_sha);
	args.push('--stat');
	return self.run("diff",
					"4b825dc642cb6eb9a060e54bf8d69288fbee4904", // null tree
					commit_sha,
					"--stat")
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

Git.prototype.revList = function(ref, max) {
	var self = this;
	max = max || 0;
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
				if (commit && commit.parents && commit.parents.length
					&& (history.length < max || max == 0)) {
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