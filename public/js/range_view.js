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
			RangeView._renderer = new CanvasRenderer(data.history);
			RangeView._renderer.setData(data.commits,
				data.size_history,
				data.diff_summaries,
				parseInt(data.fromRev), 
				parseInt(data.toRev)
			);
		},

	};
});

