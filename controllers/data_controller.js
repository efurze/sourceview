var path = require('path');
var fs = require('fs');
var persist = require('../lib/persist.js');
var Promise = require('bluebird');
Promise.promisifyAll(fs);



module.exports = {

	requestRange: function(req, res) {
		var repo = req.param('repo');
		//var from = req.param('from');
		//var to = req.param('to');
		
		var data = {};
		persist.getRevList(repo, 'master')
			.then(function(history) {
				data.commits = history;
				return persist.sizeSnapshot(repo, data.commits);
			}).then(function(sizes) {
				data.size_history = sizes;
				return persist.diffSummary(repo, data.commits);
			}).then(function(diffs) {
				data.diff_summaries = diffs;

				res.render("range", {
					title: "Source View",
					commits: JSON.stringify(data.commits),
					size_history: JSON.stringify(data.size_history),
					diff_summaries: JSON.stringify(data.diff_summaries),
					scripts: [
						{ path: "/js/canvas_renderer.js" },
						{ path: "/js/repoModel.js" },
						{ path: "/js/range_view.js" }
					]
				});
			});
	}

};