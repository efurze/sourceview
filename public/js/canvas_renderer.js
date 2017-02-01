'use strict'

var CanvasRenderer = function(range_data, history_data, diffs) {
	var self = this;
	this._range = range_data; // {'filename': size, }
	this._history = history_data; // indexed by commit
	this._diffs = diffs;		

	this._canvas = document.getElementById("repo_canvas");
	this._width = this._canvas.width;
	this._height = this._canvas.height;
	this._context = this._canvas.getContext('2d');
	this._filesSVG = SVG('filenames');;
	this._lastMouseX = -1;
	this._lastMouseY = -1;
	this._yAxis = {}; // filename to offset in lines
	this._maxLineCount = 0;

	this._fromCommit = 0;
	this._toCommit = diffs.length-1;
	this._files = Object.keys(range_data); // sorted in display order, top-to-bottom
	this._selectedFile = "";
	this._filter = "";

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	$(this._canvas).dblclick(this.historyDoubleClick.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	$("#filenames").dblclick(this.filesDoubleClick.bind(this));
	$("#filter_button").on('click', self.onFilterClick.bind(self));
/*
	let offset = $("#diff_div").offset();
	$("#diff_div").height($("#diff_div").height() * 2);
	$("#diff_div").width($("#diff_div").width() * 2);
	
	$("#diff_div").css("transform", "scale(0.5)");
	offset = $("#diff_div").offset();
	offset = $("#code_div").offset();
	$("#diff_div").offset({top: offset.top, left: offset.left});
*/
	console.log("calculateLayout");
	this.calculateLayout();
	this.render();
};

CanvasRenderer.prototype.onFilterClick = function() {
	var self = this;
	//$("#filenames").css("transform", "scale(0.5)");

	//$("#canvas_div").removeClass("col-md-10");
	//$("#canvas_div").addClass("col-md-6");


	
	self._filter = $("#filter_input").val();
	self._files = Object.keys(self._range)
					.filter(function(filename) {
						if (!self._filter || self._filter === "") {
							return true;
						}
						return filename.startsWith(self._filter);
					});
	self.calculateLayout();
	self.render();
	
};

CanvasRenderer.prototype.calculateLayout = function() {
	var self = this;

	this._files.sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});


	self._maxLineCount = 0;
	
	this._files.forEach(function(file) {
		self._yAxis[file] = self._maxLineCount;
		self._maxLineCount += self._range[file];
	});

};

CanvasRenderer.prototype.render = function() {
	var self = this;
	console.log("renderFilenames");
	self.renderFilenames();
	console.log("renderHistory");
	self.renderHistory();
	console.log("done");
};

CanvasRenderer.prototype.renderFilenames = function() {
	var self = this;
	var vb = self._filesSVG.viewbox();
	var rect = self._filesSVG.rect(vb.width, vb.height).attr({fill: '#F0DAA4'});

	var fontHeight = 10; // TODO: initialize this somehow
	var y = vb.height;
	var filecount = self._files.length;

	// Draw bottom-to-top so we elide the small files instead of the big ones
	for (var i=1; i <= filecount; i++) {
		var file = self._files[filecount - i];
		var nextShouldBeAt = (self._yAxis[file]*(vb.height-fontHeight))/self._maxLineCount;
		if (nextShouldBeAt <= y - fontHeight) {
			y = nextShouldBeAt;
			var text = self._filesSVG.text(file)
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
	}		
};

CanvasRenderer.prototype.highlightFilenames = function() {
	var self = this;
	var vb = self._filesSVG.viewbox();
	var fontHeight;


	// files in this diff
	if (self._selectedCommitIndex >= 0 && self._fromCommit != self._toCommit) {
		var diff = self._diffs[self._selectedCommitIndex];
		Object.keys(diff.diffs).forEach(function(filename) {
			fontHeight = 10;
			var y = (self._yAxis[filename]*(vb.height-fontHeight))/self._maxLineCount;

			self._filesSVG.rect(vb.width, 1.5*fontHeight)
			.attr({
				x: 0,
				y: y,
				fill: '#F0DAA4',
			});

			self._filesSVG.text(filename)
			.attr({
				fill: 'red',
				x: 10,
				y: y
			}).font({
				family: 'Helvetica',
				size: 8
			});
		});
	}

	var filename = self._selectedFile;
	if (filename) {
		fontHeight = 15; // TODO: initialize this somehow
		var y = (self._yAxis[filename]*(vb.height-fontHeight))/self._maxLineCount;

		self._filesSVG.rect(vb.width, fontHeight * 2)
			.attr({
				x: 0,
				y: y,
				fill: '#F0DAA4',
				stroke: 'black'
			});

		self._filesSVG.text(filename)
			.attr({
				fill: 'black',
				x: 5,
				y: y
			}).font({
				family: 'Helvetica',
				size: 12
			});
		}
}

CanvasRenderer.prototype.renderHistory = function() {
	var self = this;

	self._files.forEach(function(filename) {
		self.renderFileHistory(filename);
		self.renderFileDiffs(filename);
	});
};

CanvasRenderer.prototype.renderFileHistory = function(filename) {
	var self = this;

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);	
	var total_height = (self._range[filename] * self._height)/self._maxLineCount;

	var y = (self._yAxis[filename]*self._height)/self._maxLineCount;

	self._context.fillStyle = '#A2BCCD';
	self._context.fillRect(0,y, self._width, total_height);

	var x = self._width - commit_width;

	for (var index=self._fromCommit; index <= self._toCommit; index++) {
		var commit = self._history[index]; // {commit:, tree: {'file':32, ...}}
		var size = commit.tree.hasOwnProperty(filename) 
						? commit.tree[filename] : 0;
		var dy = (size*self._height)/self._maxLineCount;
		if (filename === self._selectedFile) {
			self._context.fillStyle = "grey";
		} else {
			self._context.fillStyle = '#8296A4';
		}
		self._context.fillRect(x,
			y,
			commit_width,
			dy
		);
		x -= commit_width;
	};

};


CanvasRenderer.prototype.renderFileDiffs = function(filename) {
	var self = this;

	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self.renderFileDiff(index, filename);
	};
};

CanvasRenderer.prototype.renderDiff = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];
	if (diff) {
		var files = {};
		self._files.forEach(function(file) {
			files[file] = true;
		});

		Object.keys(diff.diffs).forEach(function(filename) {
			if (files.hasOwnProperty(filename))
				self.renderFileDiff(diff_index, filename);
		});
	}
};

// diff:  // {commit:{}, diffs: {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
CanvasRenderer.prototype.renderFileDiff = function(diff_index, filename) { 
	var self = this;
	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);

	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];

	self._context.fillStyle = '#424D54';
	if (self._selectedCommitIndex == diff_index
		&& self._toCommit != self._fromCommit) {
		self._context.fillStyle = '#FFFFD5';
		self.renderDiffContent();
	}

	var x = commit_width * (self._toCommit - diff_index);

	if (diff.diffs.hasOwnProperty(filename)) {
		var edits = diff.diffs[filename].summary;
		var file_begin = self._yAxis[filename];
		var filelen = self._range[filename];
		var file_y = (file_begin*self._height)/self._maxLineCount;
		var file_dy = filelen/self._maxLineCount;
		edits.forEach(function(edit) { // "+1,9"
			var parts = edit.split(",");
			var linenum = parseInt(parts[0].slice(1));
			var len = parseInt(parts[1]);
			var dy =  (len*self._height)/self._maxLineCount;
			var y = ((file_begin+linenum)*self._height)/self._maxLineCount;

			self._context.fillRect(x,
				y,
				commit_width,
				dy
			);
		});
	}
};

CanvasRenderer.prototype.renderDiffContent = function() {
	let self = this;
	$("#code_textarea").text("");
	if (self._selectedCommitIndex >= 0 
		&& self._selectedCommitIndex < self._diffs.length) {
		let diff_info = self._diffs[self._selectedCommitIndex];
		if (diff_info && self._selectedFile) {
			let diff = diff_info.diffs;

			if (diff.hasOwnProperty(self._selectedFile)
				&& diff[self._selectedFile].raw) {
				let diff_str = decodeURI(diff[self._selectedFile].raw);
				//$("#code_textarea").text(diff_str);

				var diff2htmlUi = new Diff2HtmlUI({
					diff: diff_str
				});
				diff2htmlUi.draw('#code_div', {inputFormat: 'diff', showFiles: false, matching: 'lines'});
			}
		}
	}
};

CanvasRenderer.prototype.historyDoubleClick = function(event) {
	var self = this;
	// show commit
	var index = self.commitIndexFromXCoord(event.offsetX);
	self._selectedCommitIndex = -1;
	$("#commit_info").text(self._diffs[index].commit.commit_msg);
	self._fromCommit = index;
	self._toCommit = index;
	self._files = self._files.filter(function(filename) {
		return self._diffs[index].diffs.hasOwnProperty(filename);
	});
	self.calculateLayout();
	self.render();
};

CanvasRenderer.prototype.filesDoubleClick = function(event) {
	var self = this;
	// show file history
	if (self._selectedFile) {
		self._fromCommit = 0;
		self._toCommit = self._diffs.length-1;
		$("#filter_input").val(self._selectedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.mouseMoveHistoryWindow = function(event) {
	var self = this;
	if (event.offsetX == self._lastMouseX 
		&& event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseX != event.offsetX) {
		self._lastMouseX = event.offsetX;
		var index = self.commitIndexFromXCoord(event.offsetX);
		if (index != self._selectedCommitIndex) {
			var previous = self._selectedCommitIndex;
			self._selectedCommitIndex = index;

			$("#commit_info").text(self._diffs[self._selectedCommitIndex].commit.commit_msg);
			
			self.renderFilenames();
			if (previous >= 0) {
				self.renderDiff(previous);
			}
			self.renderDiff(index);
			self.highlightFilenames();
		}
	}

	if (self._lastMouseY != event.offsetY) {
		self.handleMouseYChange(event);
	}
};

CanvasRenderer.prototype.mouseMoveFilesWindow = function(event) {
	var self = this;
	if (event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseY != event.offsetY) {
		self.handleMouseYChange(event);
	}
};

CanvasRenderer.prototype.handleMouseYChange = function(event) {
	var self = this;
	self._lastMouseY = event.offsetY;
	var file = self.fileFromYCoord(event.offsetY);
	if (file != self._selectedFile) {
		var previous = self._selectedFile;
		self._selectedFile = file;

		self.renderFilenames();
		if (previous) {
			self.renderFileHistory(previous);
			self.renderFileDiffs(previous);
		}
		self.renderFileHistory(file);
		self.renderFileDiffs(file);
		self.highlightFilenames();
		self.renderDiffContent();
	}
};

CanvasRenderer.prototype.filePixelOffset = function(filename) {
	var self = this;
	return (self._yAxis[filename] * self._height) / self._maxLineCount;
};


CanvasRenderer.prototype.fileFromYCoord = function(y) {
	var self = this;
	var index = 0;
	var offset = 0;
	var next_index = self._files.length - 1;
	var next_offset = self._height;

	while (next_index - index > 1) {
		var bisect_index = Math.round((next_index+index)/2);
		var bisect_offset = self.filePixelOffset(self._files[bisect_index]);

		if (y <= bisect_offset) {
			next_index = bisect_index;
			next_offset = bisect_offset;
		} else {
			index = bisect_index;
			offset = bisect_offset;
		}
	}
	return self._files[index];
}

CanvasRenderer.prototype.commitIndexFromXCoord = function(x) {
	var self = this;
	var length = self._toCommit - self._fromCommit + 1;
	var index = Math.floor((length * x) / self._width);
	if (index >= 0 && index < self._diffs.length) {
		return self._toCommit-index;
	}
	return -1;
}



