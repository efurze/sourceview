'use strict'


$(function() {

	window.View = {

		_renderer: null,

		init: function(range_data, history_data, diffs) {
			/*
			diffs.forEach(function(diff) {
				diff.text = decodeURIComponent(diff.text);	
			});
			*/
			View._renderer = new CanvasRenderer(range_data, history_data, diffs);
		},

	};
});

