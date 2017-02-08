'use strict'


$(function() {

	window.View = {

		_renderer: null,

		init: function(range_data, history_data, diffs) {
			diffs.forEach(function(diff) {
				diff.diffs = JSON.parse(diff.diffs);
			});
			View._renderer = new Renderer(range_data, history_data, diffs);
		},

	};
});

