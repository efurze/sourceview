'use strict'

$(function() {

	window.Renderer = {
		
		_range: null, // {'filename': size, }
		_history: null,
		_diffs: null,
		_yAxis: {},
		_maxLineCount: 0,
		_repoSVG: null,

		init: function(range_data, history_data, diffs) {
			Renderer._range = range_data;
			Renderer._history = history_data;
			Renderer._diffs = diffs;
			Renderer.render();
		},

		render: function() {
			Renderer.renderFiles();
			Renderer.renderRepo();
			Renderer.renderDiffs();
		},

		renderFiles: function() {
			
			var files = SVG('filenames');

			var vb = files.viewbox();
			files.rect(vb.width, vb.height).attr({fill: '#F0DAA4'});

			var max_height = vb.height;
			var line_count = 0;
			var total_lines = 0;
			Object.keys(Renderer._range).forEach(function(file) {
				total_lines += Renderer._range[file];
			});

			Object.keys(Renderer._range).forEach(function(file) {
				files.text(file)
					.attr({
						fill: 'black', 
						x: 5, 
						y: (line_count*max_height)/total_lines
					}).font({
						  family:   'Helvetica'
						, size:     8
						});
				Renderer._yAxis[file] = line_count;
				line_count += Renderer._range[file];
			});			

			Renderer._maxLineCount = total_lines;
		},

		renderRepo: function() {
			Renderer._repoSVG = SVG('repo');
			var vb = Renderer._repoSVG.viewbox();
			Renderer._repoSVG.rect(vb.width, vb.height).attr({fill: '#A2BCCD'});

			var commit_width = vb.width/Renderer._history.length;
			var dx = 0;
			Renderer._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
				Object.keys(commit.tree).forEach(function(filename) {
					var size = commit.tree[filename];
					if (size) {
						Renderer._repoSVG.rect(commit_width, (size*vb.height)/Renderer._maxLineCount)
								.attr({
									x: vb.width - dx - commit_width,
									y: (Renderer._yAxis[filename]*vb.height)/Renderer._maxLineCount,
									fill:'#8296A4'});
					}
				});
				dx += commit_width;
			});
		},

		renderDiffs: function() {
			var vb = Renderer._repoSVG.viewbox();
			var commit_width = vb.width/Renderer._history.length;
			var dx = 0;

			Renderer._diffs.forEach(function(diff) { // {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
				if (!diff) 
					return;
				Object.keys(diff).forEach(function(filename) {
					var edits = diff[filename];
					var file_begin = Renderer._yAxis[filename];
					var filelen = Renderer._range[filename];
					var file_y = (file_begin*vb.height)/Renderer._maxLineCount;
					var file_dy = filelen/Renderer._maxLineCount;
					edits.forEach(function(edit) { // "+1,9"
						var parts = edit.split(",");
						var linenum = parseInt(parts[0].slice(1));
						var len = parseInt(parts[1]);
						var dy =  (len*vb.height)/Renderer._maxLineCount;
						var x = vb.width - dx - commit_width;
						var y = ((file_begin+linenum)*vb.height)/Renderer._maxLineCount;
						Renderer._repoSVG.rect(commit_width,
											dy)
											.attr({
												'x': x,
												'y': y,
												fill:'#424D54'
											});
					});
				});
				dx += commit_width;
			});
		},

	};
});

