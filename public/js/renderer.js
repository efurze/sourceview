'use strict'

var FILES_BACKGROUND_COLOR = '#F0DAA4';
var REPO_BACKGROUND_COLOR = '#A2BCCD'; // light blue
var REPO_COLOR = '#8296A4'; // medium blue
var DIFF_COLOR = '#FFFFD5'; 

var MARGIN = 5;

var FONT_NORMAL = {
	'name': '10px Helvetica',
	'height': 10,
	'color': 'black'
};

var FONT_LARGE = {
	'name': '12px Helvetica',
	'height': 12,
	'color': 'black'
};

var Renderer = function(range_data, history_data, diffs) {
	var self = this;
	self._range = range_data; // {'filename': size, }
	self._filesizes = {
		'range': range_data,
		'history': history_data // indexed by commit
	}
	self._diffs = diffs;		
	self._files = Object.keys(range_data);
	self._files.sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	self._repoCanvas = document.getElementById("repo_canvas");
	self._repoContext = self._repoCanvas.getContext('2d');

	self._width = self._repoCanvas.width;
	self._height = self._repoCanvas.height;
	
	
	self._filesCanvas = document.getElementById("filenames");
	self._filesContext = self._filesCanvas.getContext('2d');
	self._filesWidth = self._filesCanvas.width;


	self._lastMouseX = -1;
	self._lastMouseY = -1;
	self._yAxis = {}; // filename to offset in lines
	self._maxLineCount = 0;

	self._model = new RepoModel(self._filesizes, diffs);

	$(self._filesCanvas).click(self.filesClick.bind(self));

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

	var y = 0;
	var font = FONT_NORMAL;
	var linesVisible = self._model.visibleLineCount();
	self._files.forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self._filesContext.beginPath();
			self._filesContext.fillStyle = font.color;
			self._filesContext.font = font.name;
			self._filesContext.fillText(filename, MARGIN, y + font.height);
			y += self._filesizes.range[filename] * self._height / linesVisible;
		}		
	});

};

Renderer.prototype.renderRepo = function() {
	var self = this;
	self._repoContext.fillStyle = '#A2BCCD';
	self._repoContext.clearRect(0, 0, self._width, self._height);
	self._repoContext.fillRect(0, 0, self._width, self._height);
};



Renderer.prototype.filesClick = function(event) {
	var self = this;
};


