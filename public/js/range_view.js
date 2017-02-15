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
		init: function(data) {
			var revList = data.commits.map(function(commit) {
				return commit.hash;
			});
			var model = new RepoModel();
			model.setRangeData(data.commits, data.size_history, data.diff_summaries);
			RangeView._renderer = new CanvasRenderer(parseInt(data.revCount));
			RangeView._renderer.setData(revList,
				model, 
				parseInt(data.fromRev), 
				parseInt(data.toRev)
			);
		},

	};
});

