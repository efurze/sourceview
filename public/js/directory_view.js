'use strict';

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

var FONT_DIR = {
	'name': '12px Helvetica',
	'height': 12,
	'color': 'BLUE'
};



/*=======================================================================================
=======================================================================================*/

var DirectoryView = function(layout, context, model) {
	var self = this;
	self._context = context;
	self._model = null;
	self._layout = layout; // filename: {y, dy}
	self._model = model;
	self._selectedFile = '';
};

DirectoryView.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
	self._x = x;
	self._y = y;
	self._dx = dx;
	self._dy = dy;
	//LOG("relative setClip", self._name, x, y, dx, dy);
	//LOG("setClip", self._name, self.y(), dy);
}

DirectoryView.prototype.setSelectedFile = function(path) {
	var self = this;
	self._selectedFile = path;
}


DirectoryView.prototype.render = function() {
	var self = this;
	ASSERT(self._layout);
	var layout = self._layout.getLayout();
	ASSERT(layout);

	Object.keys(layout).forEach(function(path) {
		ASSERT(layout[path]);
		self._renderItem(path, layout[path].y, layout[path].dy)
	});

	if (self._selectedFile && !self._layout.isDir(self._selectedFile))
		self._renderSelected(self._selectedFile);
}

DirectoryView.prototype._renderItem = function(path, y, dy) {
	var self = this;

	if (self._layout.isDir(path)) {
		var selectedDir = self._layout.isDir(self._selectedFile)
			? self._selectedFile 
			: self._model.getParent(self._selectedFile);

		var parts = path.split('/');

		var handle = self._model.isOpen(path) ? '- ' : '+ ';
		self._renderText(handle + parts[parts.length-1] + '/', 
			parts.length * MARGIN, 
			y, 
			FONT_DIR, 
			path === selectedDir
		);
	}
}

DirectoryView.prototype._renderSelected = function(path) {
	var self = this;
	ASSERT(path);
	var parts = path.split('/');
	var filename = parts[parts.length-1];

	var font = FONT_NORMAL;	
	var context = self._context;
	context.font = font.name;

	var y = self._layout.getFileY(path);
	var x = self._dx - context.measureText(filename).width - 2*MARGIN;

	context.beginPath();
	context.fillStyle = FILES_BACKGROUND_COLOR;
	context.fillRect(x, y, self._dx, font.height);
	context.beginPath();
	context.fillStyle = font.color;
	context.fillText(filename, x, y + font.height);
}


DirectoryView.prototype._renderText = function(text, x, y, font, selected) {
	var self = this;

	var context = self._context;
	context.beginPath();
	context.fillStyle = FILES_BACKGROUND_COLOR;
	context.fillRect(x, y, self._dx, font.height);

	context.beginPath();
	context.fillStyle = selected ? 'red' : font.color;
	context.font = font.name;
	context.fillText(text, x + MARGIN, y + font.height);

	return font.height;
}



function LOG() {
	console.log.apply(console, arguments);
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
