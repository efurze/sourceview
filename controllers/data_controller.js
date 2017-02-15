var path = require('path');
var fs = require('fs');
var persist = require('../lib/persist.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);


function getData(req) {
	var repo = req.param('repo');
	var from = req.param('from') || 0;
	var to = req.param('to') || 100;
	
	var data = {};
	return persist.getRevList(repo, 'master')
		.then(function(history) {
			data.fromRev = from;
			data.toRev = to;
			data.revCount = history.length;
			data.commits = history.slice(from, to);
			return persist.sizeSnapshot(repo, data.commits);
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
		getData(req)
			.then(function(data) {
				res.render("range", {
					title: "Source View",
					repo_data: JSON.stringify(data),
					scripts: [
						{ path: "/js/canvas_renderer.js" },
						{ path: "/js/repoModel.js" },
						{ path: "/js/downloader.js" },
						{ path: "/js/range_view.js" }
					]
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