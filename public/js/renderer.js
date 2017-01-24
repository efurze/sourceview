'use strict'

$(function() {

	window.Renderer = {
		
		_range: null, // {'filename': size, }

		init: function(range_data) {
			Renderer._range = range_data;
			Renderer.render();
		},

		render: function() {
			var window_size = 1000;
			var draw = SVG('svg').size(500,2000);
			var rect = draw.rect(500,window_size).attr({fill: '#43464B'});

			var line_count = 0;
			var total_lines = 0;
			Object.keys(Renderer._range).forEach(function(file) {
				total_lines += Renderer._range[file];
			});

			Object.keys(Renderer._range).forEach(function(file) {
				draw.text(file).attr({fill: '#4682b4', x: 5, y: (line_count*window_size)/total_lines});	
				line_count += Renderer._range[file];
			});

			

		}

	};
});

