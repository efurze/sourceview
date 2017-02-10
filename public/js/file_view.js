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

/*
	@filesizes = {
	'range': {},
	'history': []
	}
*/
var FileView = function(model, filesizes) {
	var self = this;
	self._model = model;
	self._filesizes = filesizes;
	self._files = Object.keys(filesizes.range);
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
};




FileView.prototype.renderFiles = function(context) {
	var self = this;
	var x = self.x();
	var y = self.y();
	var offset_y = 0;

	
	// our name
	if (self._parent) { // don't draw root dir
		if (self._isDir) {
			//var handle = self._isOpen ? '- ' : '+ ';
			//self._renderText(handle + self._name + '/', x, y, FONT_NORMAL, context);
		} else {
			self._renderText(self._name, x, y, FONT_NORMAL, context);	
		}
	}

	if (self._isOpen) {
		// children
		for (var i=self._childNames.length-1; i >=0; i--) {
			var name = self._childNames[i];
			self._children[name].renderFiles(context);
		}
	}

	context.restore();
	return offset_y;
};

FileView.prototype._renderText = function(text, x, y, font, context) {
	var self = this;


	context.beginPath();
	context.fillStyle = FILES_BACKGROUND_COLOR;
	context.fillRect(x, y, self._dx, font.height);

	context.beginPath();
	context.fillStyle = font.color;
	context.font = font.name;
	context.fillText(text, x + MARGIN, y + font.height);

	return font.height;
}

// absolute x relative to canvas
FileView.prototype.x = function() {
	var self = this;
	return self._x + (self._parent ? self._parent.x() : 0);
};

// relative to parent
FileView.prototype.setXoffset = function(x) {
	var self = this;
	self._x = x;
};

// absolute y relative to canvas
FileView.prototype.y = function() {
	var self = this;
	var y = self._y  + (self._parent ? self._parent.y() : 0);
	return y;
};

// relative to parent
FileView.prototype.setYoffset = function(y) {
	ASSERT(typeof(y) == 'number');
	ASSERT(!isNaN(y));
	var self = this;
	//console.log(self.path(), "Y:", y);
	self._y = y;
};

FileView.prototype.setWidth = function(w) {
	ASSERT(typeof(w) == 'number');
	ASSERT(!isNaN(w));
	var self = this;
	return self._dx = w;
};

FileView.prototype.setHeight = function(h) {
	ASSERT(typeof(h) == 'number');
	ASSERT(!isNaN(h));
	var self = this;
	return self._dy = h;
};

FileView.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
	//console.log("setClip", self._name, x, y, dx, dy);
	self._x = x;
	self._y = y;
	self._dx = dx;
	self._dy = dy;
}


function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
