var Promise = require('bluebird');
var diff = require('./types/diff.js');
var Logger = require('./logger.js');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

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
	this._path = path;
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
    	return self._spawn('diff', sha1, sha2, '--numstat')
    		.then(function(diffstr) {
    			var d = new diff();
    			d.parseNumstat(diffstr);
    			return d;
    		});
    } else {
    	return self._spawn('diff', sha1, sha2)
    		.then(function(diffstr) {
    			return new diff(diffstr);
    		});
    }
};

Git.prototype._exec = function(command, args) {
	var self = this;
	var cmd = 'git' + ' --git-dir="' + self._path + '/.git" '  + command; //" --work-tree='" + self._path + "'";
	for(var i=1; i < arguments.length; i++) {
		cmd += ' ' + arguments[i];
	}

	var resolve, reject;
	var promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});

	console.log("exec:", cmd);
	exec(cmd, function(err, stdout, stderr) {
				if (err) {
					reject(err);
				} else {
					resolve(stdout);
				}
			});

	return promise;
}

Git.prototype._spawn = function(command, args) {
	var self = this;
	
	var cmd = 'git';
	var cmd_args = [
	"--git-dir=" + self._path+ "/.git",
		command
	];
	for(var i=1; i < arguments.length; i++) {
		cmd_args.push(arguments[i]);
	}

	var resolve, reject;
	var promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});


	
	var result = "";
	var sp = spawn('git', cmd_args);

	sp.on('error', function(err) {
		console.log("error", err);
	});

	sp.stdout.on('data', function(data) {
		result += data + '\n';
	});

	sp.stderr.on('data', function(data) {
		console.log('err', String(data));
	});

	sp.on('close', function(code) {
		resolve(result);
	});
	return promise;
}

/*
exec('git --git-dir="/Users/efurze/repos/git/.git" diff '
				+ history[index-1] + " " + id, function(err, stdout, stderr) {
					//console.log(stdout);
					resolve();
				});
*/

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

/*
log = {
  all: 
   [ ListLogLine {
       hash: 'a4f45465339f1d17c662d26758367f8231dd1726',
       date: '2017-02-13 12:25:56 -0800',
       message: 'Diff using exec() instead of simple-git. Much faster. (HEAD, master)',
       author_name: 'Eric Furze',
       author_email: 'efurze@yahoo-inc.com' },
     ListLogLine {
       hash: '86fdfb693db779dd199aa612e404544503da3619',
       date: '2017-02-11 19:24:23 -0800',
       message: 'Use git log to build revision history',
       author_name: 'Eric Furze',
       author_email: 'efurze@yahoo-inc.com' },
*/
Git.prototype.log = function() {
	var self = this;

	return self._git.logAsync(['--first-parent'])
		.then(function(log) {
			return log.all;
		});
};


var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Git;