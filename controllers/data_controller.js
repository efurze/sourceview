var path = require('path');
var fs = require('fs');
var persist = require('../lib/persist.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);


function getData(req) {
	var repo = req.query['repo'];
	var from = parseInt(req.query['from']);
	var to = parseInt(req.query['to']);

	if (typeof(from) == 'undefined' || typeof(to) == 'undefined') {

	}
	
	var data = {};
	return persist.getRevList(repo, 'master')
		.then(function(history) {
			data.commits = history.slice(from, to+1);
			data.fromRev = from;
			data.toRev = from + data.commits.length-1;
			return Promise.map(data.commits, function(commit_id) {
				return persist.getCommit(repo, commit_id);
			});
		}).then(function(commits) {
			data.commits = commits;
			return persist.sizeSnapshot(repo, [data.commits[0]]);
		}).then(function(sizes) {
			data.size_history = sizes;
			return persist.diffSummary(repo, data.commits);
		}).then(function(diffs) {
			data.diff_summaries = diffs;

			return data;
		});
}


module.exports = {

	requestRange: function(req, res) {
		var repo = req.query['repo'];
	
		persist.getRevList(repo, 'master')
			.then(function(revList) {
				res.render("range", {
					title: "Source View",
					repo_data: JSON.stringify(revList)
				});
			});
	},

	requestRangeJSON: function(req, res) {
		getData(req)
			.then(function(data) {
				res.send(data);
			});
	}

};