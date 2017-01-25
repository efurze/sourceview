'use strict'

$(function() {

	window.Renderer = {
		
		_range: null, // {'filename': size, }
		_history: null,
		_diffs: null,
		_yAxis: {},
		_maxLineCount: 0,
		_repoSVG: null,
		_viewportHeight: 0,
		_files: [], // sorted in display order, top-to-bottom

		init: function(range_data, history_data, diffs) {
			Renderer._range = range_data;
			Renderer._history = history_data;
			Renderer._diffs = diffs;			

			Renderer.calculateLayout();
			Renderer.render();
		},

		calculateLayout: function() {
			Renderer._files = Object.keys(Renderer._range);
			Renderer._files.sort(function (a, b) {
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
			Renderer._files.forEach(function(file) {
				Renderer._yAxis[file] = Renderer._maxLineCount;
				Renderer._maxLineCount += Renderer._range[file];
			});
		},

		render: function() {
			Renderer.renderFiles();
			Renderer.renderRepo();
			Renderer.renderDiffs();
		},

		renderFiles: function() {
			var filesSVG = SVG('filenames');
			var vb = filesSVG.viewbox();
			var rect = filesSVG.rect(vb.width, vb.height).attr({fill: '#F0DAA4'});

			var y = 0;
			var fontHeight = 0;
			Renderer._files.forEach(function(file) {
				var nextShouldBeAt = (Renderer._yAxis[file]*vb.height)/Renderer._maxLineCount;
				if (true) { //(nextShouldBeAt >= y + fontHeight) {
					y = nextShouldBeAt;
					var text = filesSVG.text(file)
						.attr({
							fill: 'black', 
							x: 5, 
							y: y
						}).font({
							  family:   'Helvetica'
							, size:     8
						});
					fontHeight = text.bbox().height;
				}
			});			
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

