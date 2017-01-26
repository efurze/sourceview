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
	this._sizeHistory = {}; // indexed by filename (not commit)	
	this._highlight = "";

	$(this._canvas).mousemove(this.mouseMove.bind(this));

	console.log("calculateLayout");
	this.calculateLayout();
	this.render();
};

CanvasRenderer.prototype.calculateLayout = function() {
	var self = this;
	this._files = Object.keys(this._range);
	this._files.sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});
	this._files.forEach(function(file) {
		self._sizeHistory[file] = [];
		self._yAxis[file] = self._maxLineCount;
		self._maxLineCount += self._range[file];
	});
/*
	// create indices
	self._files.forEach(function(filename) {
		self._sizeHistory[filename] = new Array(self._history.length);
		self._sizeHistory[filename].fill(0);
	});
	self._history.forEach(function(commit, index) {
		Object.keys(commit.tree).forEach(function(filename) {
			self._sizeHistory[filename][index] = commit.tree[filename];
		};
	});
*/
};

CanvasRenderer.prototype.render = function() {
	var self = this;
	console.log("renderFilenames");
	self.renderFilenames();
	console.log("renderHistory");
	self.renderHistory();
	console.log("renderDiffs");
	self.renderDiffs();
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

CanvasRenderer.prototype.highlightFilename = function(filename) {
	var self = this;
	var vb = self._filesSVG.viewbox();
	var fontHeight = 15; // TODO: initialize this somehow
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


CanvasRenderer.prototype.renderHistory = function() {
	var self = this;
	
	self._context.fillStyle = '#A2BCCD';
	self._context.fillRect(0,0, self._width, self._height);

	var commit_width = self._width/self._history.length;
	var dx = 0;
	self._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
		Object.keys(commit.tree).forEach(function(filename) {
			var size = commit.tree[filename];
			if (size) {
				var x = self._width - dx - commit_width;
				var y = (self._yAxis[filename]*self._height)/self._maxLineCount;
				var dy = (size*self._height)/self._maxLineCount;
				if (filename === self._highlight) {
					self._context.fillStyle = "grey";
				} else {
					self._context.fillStyle = '#8296A4';
				}
				self._context.fillRect(x,
					y,
					commit_width,
					dy
				);
			}
		});
		dx += commit_width;
	});
	
};



CanvasRenderer.prototype.renderDiffs = function() {
	var self = this;
	var commit_width = self._width/self._history.length;
	var dx = 0;

	self._context.fillStyle = '#424D54';

	self._diffs.forEach(function(diff) { // {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
		if (!diff) 
			return;
		Object.keys(diff).forEach(function(filename) {
			var edits = diff[filename];
			var file_begin = self._yAxis[filename];
			var filelen = self._range[filename];
			var file_y = (file_begin*self._height)/self._maxLineCount;
			var file_dy = filelen/self._maxLineCount;
			edits.forEach(function(edit) { // "+1,9"
				var parts = edit.split(",");
				var linenum = parseInt(parts[0].slice(1));
				var len = parseInt(parts[1]);
				var dy =  (len*self._height)/self._maxLineCount;
				var x = self._width - dx - commit_width;
				var y = ((file_begin+linenum)*self._height)/self._maxLineCount;

				self._context.fillRect(x,
					y,
					commit_width,
					dy
				);
			});
		});
		dx += commit_width;
	});
};

CanvasRenderer.prototype.mouseMove = function(event) {
	var self = this;
	if (event.offsetX == self._lastMouseX 
		&& event.offsetY == self._lastMouseY ) {
		return;
	}

	self._lastMouseX = event.offsetX;

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		var file = self.fileFromYCoord(event.offsetY);
		if (file != self._highlight) {
			self._highlight = file;
			self.renderHistory();
			self.renderDiffs();
			self.renderFilenames();
			self.highlightFilename(file);
		}
	}
};

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



