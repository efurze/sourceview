'use strict'

$(function() {

	window.Renderer = {
		
		_range: null, // {'filename': size, }

		init: function(range_data) {
			Renderer._range = range_data;
			Renderer.render();
		},

		render: function() {
			var repo = SVG('repo');
			var files = SVG('filenames');

			var vb = files.viewbox();
			files.rect(vb.width, vb.height).attr({fill: 'grey'});
			
			vb = repo.viewbox();
			repo.rect(vb.width, vb.height).attr({fill: '#43464B'});

			var max_height = vb.height;
			var line_count = 0;
			var total_lines = 0;
			Object.keys(Renderer._range).forEach(function(file) {
				total_lines += Renderer._range[file];
			});

			Object.keys(Renderer._range).forEach(function(file) {
				files.text(file).attr({fill: 'black', x: 5, y: (line_count*max_height)/total_lines});	
				line_count += Renderer._range[file];
			});

			

		}

	};
});

