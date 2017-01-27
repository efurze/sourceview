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
	this._files = []; // sorted in display order, top-to-bottom
	this._selectedFile = "";
	this._filter = "";

	$(this._canvas).mousemove(this.mouseMove.bind(this));
	$(this._canvas).dblclick(this.historyDoubleClick.bind(this));
	$("#filter_button").on('click', self.onFilterClick.bind(self));

	console.log("calculateLayout");
	this.calculateLayout();
	this.render();
};

CanvasRenderer.prototype.onFilterClick = function() {
	var self = this;
	self._filter = $("#filter_input").val();
	self.calculateLayout();
	self.render();
};

CanvasRenderer.prototype.calculateLayout = function() {
	var self = this;
	this._files = Object.keys(this._range)
					.filter(function(filename) {
						if (!self._filter || self._filter === "") {
							return true;
						}
						return filename.startsWith(self._filter);
					});
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
	console.log("renderDiffs");
	//self.renderDiffs();
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
	if (self._selectedCommitIndex >= 0) {
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

	var commit_width = self._width/self._history.length;	
	var total_height = (self._range[filename] * self._height)/self._maxLineCount;

	var y = (self._yAxis[filename]*self._height)/self._maxLineCount;

	self._context.fillStyle = '#A2BCCD';
	self._context.fillRect(0,y, self._width, total_height);

	var x = self._width - commit_width;

	self._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
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
	});

};


CanvasRenderer.prototype.renderFileDiffs = function(filename) {
	var self = this;

	self._diffs.forEach(function(diff, index) { 
		self.renderDiff(index);
	});
};

CanvasRenderer.prototype.renderDiff = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];
	Object.keys(diff.diffs).forEach(function(filename) {
		self.renderFileDiff(diff_index, filename);
	});
};

// diff:  // {commit:{}, diffs: {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
CanvasRenderer.prototype.renderFileDiff = function(diff_index, filename) { 
	var self = this;
	var commit_width = self._width/self._history.length;

	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];

	self._context.fillStyle = '#424D54';
	if (self._selectedCommitIndex == diff_index) {
		self._context.fillStyle = '#FFFFD5';
	}

	var x = commit_width * (self._diffs.length - diff_index - 1);

	if (diff.diffs.hasOwnProperty(filename)) {
		var edits = diff.diffs[filename];
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

CanvasRenderer.prototype.historyDoubleClick = function(event) {
	var self = this;
	if (self._selectedFile) {
		$("#filter_input").val(self._selectedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.mouseMove = function(event) {
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
			self.renderDiff(previous);
			self.renderDiff(index);
			self.highlightFilenames();
		}
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		var file = self.fileFromYCoord(event.offsetY);
		if (file != self._selectedFile) {
			var previous = self._selectedFile;
			self._selectedFile = file;

			self.renderFilenames();
			self.renderFileHistory(previous);
			self.renderFileDiffs(previous);
			self.renderFileHistory(file);
			self.renderFileDiffs(file);
			self.highlightFilenames();
		}
	}
};

// TODO: make this a binary search
CanvasRenderer.prototype.fileFromYCoord = function(y) {
	var self = this;
	for (var i=0; i < self._files.length; i++) {
		var pixelOffset = (self._yAxis[self._files[i]] * self._height) / self._maxLineCount;
		if (y <= pixelOffset) {
			return i > 0 ? self._files[i-1] : self._files[0];
		}
	}
	return "";
}

CanvasRenderer.prototype.commitIndexFromXCoord = function(x) {
	var self = this;
	var index = Math.floor((self._diffs.length * x) / self._width);
	if (index >= 0 && index < self._diffs.length) {
		return self._diffs.length-index-1;
	}
	return -1;
}



