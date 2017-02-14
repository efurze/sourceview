'use strict'


$(function() {

	window.View = {

		_renderer: null,

		init: function(range_data, history_data, diffs) {
			diffs.forEach(function(diff) {
				diff.diffs = JSON.parse(diff.diffs);
			});

			var revList = diffs.map(function(diff) {
				return diff.commit.id;
			});
			var model = new RepoModel();
			model.setData(history_data, diffs);	

			View._renderer = new CanvasRenderer(revList, model);
		},

	};
});

