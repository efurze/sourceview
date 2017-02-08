'use strict';

var BACKGROUND_COLOR = '#F0DAA4';
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

var DirectoryView = function(name, parent) {
	var self = this;
	self._name = name;
	self._parent = parent;
	self._children = [];
	self._childDirs = {};
	self._isOpen = false;
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
};

DirectoryView.prototype.handleFilesClick = function(event) {
	var self = this;
	console.log("click", event.offsetY);
	var handled = false;

	if (self._isOpen) {
		var subdirs = Object.keys(self._childDirs);
		var index = 0;
		while (!handled && index < subdirs.length) {
			handled = self._childDirs[subdirs[index]].handleFilesClick(event);
			index ++;
		}
	}

	if (!handled) {
		var y = self.y();
		if (event.offsetY >= y && event.offsetY <= (y + FONT_NORMAL.height)) {
			console.log("event handled by", self._name);
			handled = true;
			self.toggleOpen();
		} else {
			console.log("event NOT handled by", self._name,
				"our Ymin:", y,
				"our Ymax:", y + FONT_NORMAL.height);
		}
	}

	return handled;
};

/*
	@range = {
		<filename>: int
	}
*/
DirectoryView.prototype.addChildren = function(filenames) {
	var self = this;

	filenames.forEach(function(filename) {
		self.addChild(filename);		
	});
};

DirectoryView.prototype.addChild = function(filename) {
	var self = this;

	var parts = filename.split('/');
	if (parts.length > 1) {
		var dirname = parts[0];
		var dir = self._childDirs[dirname] 
			|| new DirectoryView(dirname, self);
		self._childDirs[dirname] = dir;
		// pop off the directory name
		parts.shift();
		dir.addChild(parts.join('/'));
	} else {
		self._children.push(filename);
	}
};

DirectoryView.prototype.renderNames = function(context) {
	var self = this;
	var x = self.x();
	var y = self.y();
	var offset_y = 0;
	
	// our name
	if (self._parent) { // don't draw root dir
		var handle = self._isOpen ? '- ' : '+ ';
		offset_y += self._renderText(handle + self._name + '/', x, y, FONT_NORMAL, context);
	}

	if (self._isOpen) {
		// our files
		self._children.forEach(function(child) {
			offset_y += self._renderText(child, x + MARGIN, y + offset_y, FONT_NORMAL, context);		
		});

		// subdirs
		Object.keys(self._childDirs).forEach(function(dirname) {
			self._childDirs[dirname].setXoffset(MARGIN);
			self._childDirs[dirname].setYoffset(offset_y);
			offset_y += self._childDirs[dirname].renderNames(context);
		});
	}

	return offset_y;
};

DirectoryView.prototype._renderText = function(text, x, y, font, context) {
	var self = this;


	context.beginPath();
	context.fillStyle = BACKGROUND_COLOR;
	context.fillRect(x, y, self._dx, font.height);

	context.beginPath();
	context.fillStyle = font.color;
	context.font = font.name;
	context.fillText(text, x + MARGIN, y + font.height);

	return font.height;
}

DirectoryView.prototype.setOpen = function(isOpen) {
	var self = this;
	self._isOpen = isOpen;
};

DirectoryView.prototype.toggleOpen = function() {
	var self = this;
	self._isOpen = !self._isOpen;
	console.log(self._name, "open:", self._isOpen);
};

// absolute x relative to canvas
DirectoryView.prototype.x = function() {
	var self = this;
	return self._x + (self._parent ? self._parent.x() : 0);
};

// relative to parent
DirectoryView.prototype.setXoffset = function(x) {
	var self = this;
	self._x = x;
};

// absolute y relative to canvas
DirectoryView.prototype.y = function() {
	var self = this;
	return self._y  + (self._parent ? self._parent.y() : 0);
};

// relative to parent
DirectoryView.prototype.setYoffset = function(y) {
	var self = this;
	console.log(self._name, "Y:", y);
	self._y = y;
};

DirectoryView.prototype.setWidth = function(w) {
	var self = this;
	return self._dx = w;
};

DirectoryView.prototype.setHeight = function(h) {
	var self = this;
	return self._dy = h;
};

