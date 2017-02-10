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
var FileView = function(name, filesizes, diffs, parent, isDir) {
	var self = this;
	self._name = name;
	self._filesizes = filesizes;
	self._diffs = diffs;
	self._isDir = isDir || false;
	self._parent = parent;
	self._children = {};
	self._isOpen = true;
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;

	self._childNames = [];
};

FileView.prototype.path = function() {
	var self = this;
	if (!self._parent) {
		return ""; // for root dir
	}
	else if (self._parent.path()) {
		return self._parent.path() + '/' + self._name;
	} else {
		return self._name;
	}
};

FileView.prototype.isDir = function() {
	return this._isDir;
};

FileView.prototype.visibleLineCount = function() {
	var self = this;
	var total = 0;
	if (self._isOpen) {
		if (self._filesizes.range.hasOwnProperty(self.path())) {
			total += self._filesizes.range[self.path()];
		}
		self._childNames.forEach(function(name) {
			total += self._children[name].visibleLineCount();
		});
	}
	return total;
};

FileView.prototype.handleFilesClick = function(event) {
	var self = this;
	//console.log("click", event.offsetY);
	var handled = false;

	if (self._isDir) {
		if (self._isOpen) {
			var subdirs = Object.keys(self._children);
			var index = 0;
			while (!handled && index < subdirs.length) {
				handled = self._children[subdirs[index]].handleFilesClick(event);
				index ++;
			}
		}

		if (!handled) {
			var y = self.y();
			if (event.offsetY >= y && event.offsetY <= (y + FONT_NORMAL.height)) {
				//console.log("event handled by", self._name);
				handled = true;
				self.toggleOpen();
			}
		}
	}

	return handled;
};


FileView.prototype.addChildren = function(filenames) {
	var self = this;

	filenames.forEach(function(filename) {
		self.addChild(filename);		
	});
};

FileView.prototype.addChild = function(filename) {
	var self = this;

	var parts = filename.split('/');
	var dirname = parts[0];
	var dir = self._children[dirname] 
		|| new FileView(dirname, 
			self._filesizes, 
			self._diffs, 
			self,
			parts.length > 1);
	if (!self._children.hasOwnProperty(dirname)) {
		self._children[dirname] = dir;
		self._childNames.push(dirname);
	}
	if (parts.length > 1) {
		// pop off the directory name
		parts.shift();
		dir.addChild(parts.join('/'));
	}
};


FileView.prototype.layout = function() {
	var self = this;
	var y = 0;
	var lineCount = self.visibleLineCount();

	self._childNames.forEach(function(name) {
		var child = self._children[name];
		var childLineCount = child.visibleLineCount();
		var dy = (childLineCount * self._dy) / lineCount;
		if (!child._isOpen) {
			dy = 0;
		}
		child.setClip(self._x + MARGIN, y, self._dx, dy);
		//if (child.isDir()) {
			console.log("FILE", child._name, y, dy);
		//}
		child.layout();
		y += dy;
	});
};


FileView.prototype.renderRepo = function(context) {
	var self = this;
	if (self._isOpen) {

	} else {

	}
};


FileView.prototype.renderFiles = function(context) {
	var self = this;
	var x = self.x();
	var y = self.y();
	var offset_y = 0;

	context.save();
	context.beginPath();
	context.rect(x, y, self._dx, self._dy);
	context.clip();

	
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

FileView.prototype.setOpen = function(isOpen) {
	var self = this;
	self._isOpen = isOpen;
};

FileView.prototype.toggleOpen = function() {
	var self = this;
	self._isOpen = !self._isOpen;
	console.log(self._name, "open:", self._isOpen);
};

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
