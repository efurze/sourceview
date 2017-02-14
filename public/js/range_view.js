'use strict'


$(function() {

	window.RangeView = {

		_renderer: null,
/*
@data = {
	commits: [
		{
			hash: <sha>,
			date:
			message:
			author_name:
			author_email:
		},
		...
	]
	size_history: {
		commit_id: {
			filename: length,
			...
		}
		...
	}
	diff_summaries: {
		commit_id: {
			filename: ["-0,0", "+1, 23"],
			...
		}
		...
	}
}
*/
		init: function(commits, size_history, diff_summaries) {
			var revList = commits.map(function(commit) {
				return commit.hash;
			});
			var model = new RepoModel();
			model.setRangeData(commits, size_history, diff_summaries);
			RangeView._renderer = new CanvasRenderer(revList, model);
		},

	};
});

