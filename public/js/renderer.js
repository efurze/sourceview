'use strict'

var Renderer = function(range_data, history_data, diffs) {
	var self = this;
	self._range = range_data; // {'filename': size, }
	self._history = history_data; // indexed by commit
	self._diffs = diffs;		

	self._canvas = document.getElementById("repo_canvas");
	self._context = self._canvas.getContext('2d');

	self._width = self._canvas.width;
	self._height = self._canvas.height;
	
	
	self._filesCanvas = document.getElementById("filenames");
	self._filesContext = self._filesCanvas.getContext('2d');
	self._filesWidth = self._filesCanvas.width;

	self._lastMouseX = -1;
	self._lastMouseY = -1;
	self._yAxis = {}; // filename to offset in lines
	self._maxLineCount = 0;

	self._root = new DirectoryView("/");
	self._root.setOpen(true);
	self._root.addChildren(Object.keys(range_data));
	self._root.setHeight(self._height);
	self._root.setWidth(self._width);

	$(self._filesCanvas).click(self.filesClick.bind(self));

	self.render();
};




Renderer.prototype.render = function() {
	var self = this;
	self.renderFilenames();
};

Renderer.prototype.renderFilenames = function() {
	var self = this;
	self._filesContext.fillStyle = '#F0DAA4';
	self._filesContext.strokeStyle = '#F0DAA4';
	self._filesContext.clearRect(0, 0, self._filesWidth, self._height);
	self._filesContext.fillRect(0, 0, self._filesWidth, self._height);

	self._root.renderNames(self._filesContext);
};



Renderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._root.handleFilesClick(event)) {
		self.render();
	}
};


