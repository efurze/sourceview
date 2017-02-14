var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
Promise.promisifyAll(fs);

var DATA_DIR = "/Users/efurze/repos/sourceview/model/data";
var REVISION_FILE = "commithistory.json";

module.exports = {

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