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
	this._lastMouseX = -1;
	this._lastMouseY = -1;
	this._yAxis = {};
	this._maxLineCount = 0;
	this._viewportHeight = 0;
	this._files = []; // sorted in display order, top-to-bottom
	this._sizeHistory = {}; // indexed by filename (not commit)	

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
	var filesSVG = SVG('filenames');
	var vb = filesSVG.viewbox();
	var rect = filesSVG.rect(vb.width, vb.height).attr({fill: '#F0DAA4'});

	var fontHeight = 10; // TODO: initialize this somehow
	var y = vb.height;
	var filecount = self._files.length;

	// Draw bottom-to-top so we elide the small files instead of the big ones
	for (var i=1; i <= filecount; i++) {
		var file = self._files[filecount - i];
		var nextShouldBeAt = (self._yAxis[file]*(vb.height-fontHeight))/self._maxLineCount;
		if (nextShouldBeAt <= y - fontHeight) {
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
	}		
};

CanvasRenderer.prototype.renderHistory = function() {
	var self = this;
	
	self._context.fillStyle = '#A2BCCD';
	self._context.fillRect(0,0, self._width, self._height);

	self._context.fillStyle = '#8296A4';
	var commit_width = self._width/self._history.length;
	var dx = 0;
	self._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
		Object.keys(commit.tree).forEach(function(filename) {
			var size = commit.tree[filename];
			if (size) {
				var x = self._width - dx - commit_width;
				var y = (self._yAxis[filename]*self._height)/self._maxLineCount;
				var dy = (size*self._height)/self._maxLineCount;
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
	if (event.x == self._lastMouseX 
		&& event.y == self._lastMouseY ) {
		return;
	}

	self._lastMouseX = event.x;
	self._lastMouseY = event.y;
};



