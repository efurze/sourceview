var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
Promise.promisifyAll(fs);


var DATA_DIR = './model/data/';

var REVISION_FILE = 'commithistory.json';

var COMMIT_DIR = "commits";
var DIFF_DIR = "diffs";
var DIFF_SUMMARY_DIR = "diff_summaries";
var SIZE_DIR = "sizes";

function dir(repo) {
	return DATA_DIR + repo;
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

module.exports = {

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
		return fs.writeFileAsync(filename, JSON.stringify(sizes));
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
			var id = commit.hash;
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
	sizeSnapshot: function(repo, commit_list) {
		var dir = DATA_DIR + '/' + repo;
		var sizes = {};
		return Promise.each(commit_list, function(commit, index) {
			//console.log(index);
			var id = commit.hash;
			return fs.readFileAsync(dir + '/sizes/' + id)
				.then(function(size) {
					sizes[id] = JSON.parse(size);
				});
		}).then(function() {
			return sizes;
		});
	},

};