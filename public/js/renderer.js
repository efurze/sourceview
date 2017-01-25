'use strict'

$(function() {

	window.Renderer = {
		
		_range: null, // {'filename': size, }
		_history: null,
		_yAxis: {},
		_maxLineCount: 0,

		init: function(range_data, history_data) {
			Renderer._range = range_data;
			Renderer._history = history_data;
			Renderer.render();
		},

		render: function() {
			Renderer.renderFiles();
			Renderer.renderRepo();
		},

		renderFiles: function() {
			
			var files = SVG('filenames');

			var vb = files.viewbox();
			files.rect(vb.width, vb.height).attr({fill: '#3D85C6'});

			var max_height = vb.height;
			var line_count = 0;
			var total_lines = 0;
			Object.keys(Renderer._range).forEach(function(file) {
				total_lines += Renderer._range[file];
			});

			Object.keys(Renderer._range).forEach(function(file) {
				files.text(file).attr({fill: 'black', x: 5, y: (line_count*max_height)/total_lines});
				Renderer._yAxis[file] = line_count;
				line_count += Renderer._range[file];
			});			

			Renderer._maxLineCount = total_lines;
		},

		renderRepo: function() {
			var repo = SVG('repo');
			var vb = repo.viewbox();
			repo.rect(vb.width, vb.height).attr({fill: '#A2BCCD'});

			var commit_width = vb.width/Renderer._history.length;
			var dx = 0;
			Renderer._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
				console.log(commit.commit);
				Object.keys(commit.tree).forEach(function(filename) {
					var size = commit.tree[filename];
					if (size) {
						repo.rect(commit_width, (size*vb.height)/Renderer._maxLineCount)
								.attr({
									x: vb.width - dx - commit_width,
									y: (Renderer._yAxis[filename]*vb.height)/Renderer._maxLineCount,
									fill:'#8296A4'});
					}
				});
				dx += commit_width;
			});
		},

	};
});

