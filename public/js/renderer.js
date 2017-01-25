'use strict'

var Renderer = function(range_data, history_data, diffs) {
	var self = this;
	this._range = range_data; // {'filename': size, }
	this._history = history_data; // indexed by commit
	this._diffs = diffs;		

	this._lastMouseX = -1;
	this._lastMouseY = -1;
	this._yAxis = {};
	this._maxLineCount = 0;
	this._repoSVG = null;
	this._viewportHeight = 0;
	this._files = []; // sorted in display order, top-to-bottom
	this._sizeHistory = {}; // indexed by filename (not commit)	

	this._repoSVG = SVG('repo');
	this._repoSVG.mousemove(function(event) {
		self.mouseMove(event);
	});
	this.calculateLayout();
	this.render();
};

Renderer.prototype.calculateLayout = function() {
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

Renderer.prototype.render = function() {
	var self = this;
	self.renderFilenames();
	self.renderHistory();
	self.renderDiffs();
};

Renderer.prototype.renderFilenames = function() {
	var self = this;
	var filesSVG = SVG('filenames');
	var vb = filesSVG.viewbox();
	var rect = filesSVG.rect(vb.width, vb.height).attr({fill: '#F0DAA4'});

	var y = 0;
	var fontHeight = 0;
	self._files.forEach(function(file) {
		var nextShouldBeAt = (self._yAxis[file]*(vb.height-fontHeight))/self._maxLineCount;
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
};

Renderer.prototype.renderHistory = function() {
	var self = this;
	var vb = self._repoSVG.viewbox();
	self._repoSVG.rect(vb.width, vb.height).attr({fill: '#A2BCCD'});

	var commit_width = vb.width/self._history.length;
	var dx = 0;
	self._history.forEach(function(commit) { // {commit:, tree: {'file':32, ...}}
		Object.keys(commit.tree).forEach(function(filename) {
			var size = commit.tree[filename];
			if (self._sizeHistory[filename]) {
				self._sizeHistory[filename].push(size);
			}
			if (size) {
				self._repoSVG.rect(commit_width, (size*vb.height)/self._maxLineCount)
						.attr({
							x: vb.width - dx - commit_width,
							y: (self._yAxis[filename]*vb.height)/self._maxLineCount,
							fill:'#8296A4'});
			}
		});
		dx += commit_width;
	});
};

Renderer.prototype.renderDiffs = function() {
	var self = this;
	var vb = self._repoSVG.viewbox();
	var commit_width = vb.width/self._history.length;
	var dx = 0;

	self._diffs.forEach(function(diff) { // {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
		if (!diff) 
			return;
		Object.keys(diff).forEach(function(filename) {
			var edits = diff[filename];
			var file_begin = self._yAxis[filename];
			var filelen = self._range[filename];
			var file_y = (file_begin*vb.height)/self._maxLineCount;
			var file_dy = filelen/self._maxLineCount;
			edits.forEach(function(edit) { // "+1,9"
				var parts = edit.split(",");
				var linenum = parseInt(parts[0].slice(1));
				var len = parseInt(parts[1]);
				var dy =  (len*vb.height)/self._maxLineCount;
				var x = vb.width - dx - commit_width;
				var y = ((file_begin+linenum)*vb.height)/self._maxLineCount;
				self._repoSVG.rect(commit_width,
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
};


Renderer.prototype.mouseMove = function(event) {
	var self = this;
	if (event.x == self._lastMouseX 
		&& event.y == self._lastMouseY ) {
		return;
	}

	self._lastMouseX = event.x;
	self._lastMouseY = event.y;
};



