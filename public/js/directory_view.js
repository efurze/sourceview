'use strict';


var MARGIN = 5;

/*=======================================================================================
=======================================================================================*/

var DirectoryView = function(layout, context) {
	var self = this;
	self._context = context;
	self._layout = layout; // filename: {y, dy}
	self._highlightedFile = '';
};

DirectoryView.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
	self._x = x;
	self._y = y;
	self._dx = dx;
	self._dy = dy;
}

DirectoryView.prototype.setHighlightedFile = function(path) {
	var self = this;
	self._highlightedFile = path;
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

	if (self._highlightedFile && !self._layout.isDir(self._highlightedFile))
		self._renderHighlighted(self._highlightedFile);
}

DirectoryView.prototype._renderItem = function(path, y, dy) {
	var self = this;

	if (self._layout.isDir(path)) {
		var selectedDir;
		if (self._highlightedFile) {
			selectedDir = self._layout.isDir(self._highlightedFile)
				? self._highlightedFile 
				: self._layout.getParent(self._highlightedFile);
		}

		var parts = path.split('/').filter(function(part) {
			return part.trim().length;
		});

		var handle = self._layout.isOpen(path) ? '- ' : '+ ';
		self._renderText(handle + parts[parts.length-1] + '/', 
			parts.length * MARGIN, 
			y, 
			FONT_DIR, 
			path === selectedDir
		);
	}
}

DirectoryView.prototype._renderHighlighted = function(path) {
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
	context.fillStyle = COLORS.FILES_BACKGROUND;
	context.fillRect(x, y, self._dx, font.height);
	context.beginPath();
	context.fillStyle = font.color;
	context.fillText(filename, x, y + font.height);
}


DirectoryView.prototype._renderText = function(text, x, y, font, selected) {
	var self = this;

	var context = self._context;
	context.beginPath();
	context.fillStyle = COLORS.FILES_BACKGROUND;
	context.fillRect(x, y, self._dx, font.height);

	context.beginPath();
	context.fillStyle = selected ? 'red' : font.color;
	context.font = font.name;
	context.fillText(text, x + MARGIN, y + font.height);

	return font.height;
}


