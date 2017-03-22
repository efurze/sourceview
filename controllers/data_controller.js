var path = require('path');
var fs = require('fs');
var persist = require('../lib/persist.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);





function getData(repo, from, to) {

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
			return persist.sizeTree(repo, [data.commits[0]]);
		}).then(function(sizes) {
			data.size_history = sizes;
			return persist.diffSummary(repo, data.commits);
		}).then(function(diffs) {
			data.diff_summaries = diffs;
			return data;
		});
}


module.exports = {

	revList: function(req, res) {
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
		getData(req.query['repo'], 
				parseInt(req.query['from']), 
				parseInt(req.query['to'])
			).then(function(data) {
				res.send(data);
			});
	},

	getDiffJSON: function(req, res) {
		const sha = req.query['commit'];
		persist.getDiff(req.query['repo'], sha)
			.then(function(diff) {
				const ret = {};
				ret[sha] = diff;
				res.send(ret);
			});
	},

	chart: function(req, res) {
		var repo = req.query['repo'];
		var data = {};

		persist.getRevList(repo, 'master')
			.then(function(revList) {
				return Promise.mapSeries(revList, function(sha) {
					return persist.getCommit(repo, sha);
				});
			}).then(function(commitList) {
				data.revList = commitList;
				var lineCount = [];

				return Promise.each(commitList, function(commit, index) {
					var sha = commit.id
					return persist.sizeSnapshot(repo, [{id:sha}])
						.then(function(filesizes) {
							var total = 0;
							Object.keys(filesizes[sha]).forEach(function(filename) {
								total += filesizes[sha][filename];
							});
							lineCount.push(total);
						});
				}).then(function() {
					return lineCount;
				});
			}).then(function(lineCount) {
				data.lineCount = lineCount;
				var linesChanged = [];
				return Promise.each(data.revList, function(commit, index) {
					var sha = commit.id;
					return persist.diffSummary(repo, [{id:sha}])
						.then(function(summaries) {
							summaries = summaries[sha];
							var delta = 0;
							Object.keys(summaries).forEach(function(filename) {
								var edits = summaries[filename]; // [[169,-7], [169,7], ... ],
								edits.forEach(function(change) { // [169,-7]
									delta += change[1];
								});
							});
							linesChanged.push(delta);
						});
				}).then(function() {
					return linesChanged;
				});
			}).then(function(linesChanged) {
				data.linesChanged = linesChanged;
				res.render("chart", {
						title: "Source View",
						data: JSON.stringify(data),
						scripts: [
							{ path: "//www.google.com/jsapi?autoload={'modules':[{'name':'visualization','version':'1','packages':['corechart']}]}" }
						]
					}); 
			});
	}

};