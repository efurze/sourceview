'use strict'

var Renderer = function(range_data, history_data, diffs) {
	var self = this;
	self._range = range_data; // {'filename': size, }
	self._filesizes = {
		'range': range_data,
		'history': history_data // indexed by commit
	}
	self._diffs = diffs;		

	self._repoCanvas = document.getElementById("repo_canvas");
	self._repoContext = self._repoCanvas.getContext('2d');

	self._width = self._repoCanvas.width;
	self._height = self._repoCanvas.height;
	
	
	self._filesCanvas = document.getElementById("filenames");
	self._filesContext = self._filesCanvas.getContext('2d');
	self._filesWidth = self._filesCanvas.width;

	self._dirCanvas = document.getElementById("directories");
	self._dirContext = self._dirCanvas.getContext('2d');

	self._lastMouseX = -1;
	self._lastMouseY = -1;
	self._yAxis = {}; // filename to offset in lines
	self._maxLineCount = 0;

	self._dirView = new DirectoryView("/", self._filesizes, diffs, null, true);
	self._dirView.setOpen(true);
	self._dirView.setClip(0,0,self._dirCanvas.width, self._height);
	self._dirView.addChildren(Object.keys(range_data));

	self._fileView = new FileView("/", self._filesizes, diffs, null, true);
	self._fileView.setOpen(true);
	self._fileView.setClip(0,0,self._filesCanvas.width, self._height);
	self._fileView.addChildren(Object.keys(range_data));

	$(self._dirCanvas).click(self.filesClick.bind(self));

	self._dirView.layout();
	self._fileView.layout();
	self.render();
};




Renderer.prototype.render = function() {
	var self = this;
	self.renderFilenames();
	self.renderRepo();
};

Renderer.prototype.renderFilenames = function() {
	var self = this;
	self._filesContext.beginPath();
	self._filesContext.fillStyle = '#F0DAA4';
	self._filesContext.clearRect(0, 0, self._filesWidth, self._height);
	self._filesContext.fillRect(0, 0, self._filesWidth, self._height);

	self._fileView.renderFiles(self._filesContext);


	self._dirContext.beginPath();
	self._dirContext.fillStyle = '#F0DAA4';
	self._dirContext.clearRect(0, 0, self._filesWidth, self._height);
	self._dirContext.fillRect(0, 0, self._filesWidth, self._height);

	self._dirView.renderDirectories(self._dirContext);
};

Renderer.prototype.renderRepo = function() {
	var self = this;
	self._repoContext.fillStyle = '#A2BCCD';
	self._repoContext.clearRect(0, 0, self._width, self._height);
	self._repoContext.fillRect(0, 0, self._width, self._height);
};



Renderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._dirView.handleFilesClick(event)) {
		self._dirView.layout();
		self._fileView.layout();
		self.render();
	}
};


