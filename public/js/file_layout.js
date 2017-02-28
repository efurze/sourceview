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


var Layout = function(model) {
	this._root = new LayoutNode("/", model);
	this._model = model;
	if (model) {
		model.addListener(this._fileAddedCB.bind(this));
	}
	this._listeners = [];
}

Layout.prototype.addListener = function(cb) {
	this._listeners.push(cb);
}

Layout.prototype.setClip = function(x,y,dx,dy) {
	ASSERT(this._root);
	this._root.setClip(x,y,dx,dy);
};


Layout.prototype._fileAddedCB = function(filename) {
	ASSERT(this._root);
	var parent = this._root.getParentDir(filename);
	ASSERT(parent);
	if (parent) {
		parent.addFile(filename);
	}
};

Layout.prototype.layout = function() {
	ASSERT(this._root);
	this._root.layout();
	this._listeners.forEach(function(cb) {
		cb();
	});
};

Layout.prototype.closeAll = function() {
	ASSERT(this._root);
	this._root.closeAll();
};

Layout.prototype.displayOrder = function() {
	var self = this;
	return self._root.displayOrder();
};

Layout.prototype.getLayout = function() {
	var self = this;
	self._layout =  self._root.getLayout();
	return JSON.parse(JSON.stringify(self._layout));
};

Layout.prototype.getFileY = function(filename) {
	ASSERT(this._root);
	return this._root.getFileY(filename);
};

Layout.prototype.getFileDY = function(filename) {
	ASSERT(this._root);
	return this._root.getFileDY(filename);
};

Layout.prototype.getFileAtY = function(y) {
	var self = this;
	ASSERT(self._layout);
};



/*=======================================================================================
=======================================================================================*/

var LayoutNode = function(name, model, parent) {
	ASSERT(name.length);
	var self = this;
	self._parent = parent;
	self._model = model;
	self._name = name;
	self._childDirs = {};
	self._children = [];
	self._layout = {}; // filename: {y, dy}
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
};

LayoutNode.prototype.displayOrder = function() {
	var self = this;
	var names = [];
	self._children.forEach(function(name) {
		var path = self.childPath(name);
		names.push(path);
		if (self._model.isDir(path)) {
			if (self._model.isOpen(path)) {
				names = names.concat(self._childDirs[name].displayOrder());
			}
		}
	});
	return names;
}

/*
	Includes open directories

	returns: {
		filepath: {
			y:
			dy:
		}
	}
*/
LayoutNode.prototype.getLayout = function() {
	var self = this;
	
	var layout = {};
	if (self._model.isOpen(self.path())) {
		self._children.forEach(function(child) {
			layout[child] = {
				y: self.getFileY(child),
				dy: self.getFileDY(child)
			};
		});
		Object.keys(self._childDirs).forEach(function(name) {
			var sub = self._childDirs[name].getLayout();
			if (sub) {
				Object.keys(sub).forEach(function(key) {
					layout[name + "/" + key] = sub[key];
				});
			}
		});
	}
	return layout;
}

LayoutNode.prototype.isRoot = function() {
	return !this._parent;
}

LayoutNode.prototype.closeAll = function() {
	var self = this;

	Object.keys(self._childDirs).forEach(function(name) {
		self._childDirs[name].closeAll();
	});

	if (!self.isRoot()) {
		self._model.setOpen(self.path(), false);
	}
}

LayoutNode.prototype.path = function() {
	var self = this;
	var path = "";
	if (self._parent) {
		path = self._parent.path();
	} else {
		return "";
	}
	if (path.length) {
		path += '/';
	}
	path += self._name;
	return path;
}

LayoutNode.prototype.childPath = function(name) {
	var self = this;
	var path = self.path();
	if (path.length) {
		path += '/';
	}
	return path + name;
}


LayoutNode.prototype.setModel = function() {
	var self = this;
	self._childDirs = {};
	self._children = [];
	Layout._model.getChildren(self.path()).forEach(function(child) {
		self.addFile(child);
	});

	Object.keys(self._childDirs).forEach(function(dirname) {
		self._childDirs[dirname].setModel();
	});
}

// @filename: full path
LayoutNode.prototype.addFile = function(filename) {
	var self = this;
	if (!filename || !filename.length)
		return;
	var parts = filename.split('/');
	var name = parts[parts.length-1];
	if (self._model.isDir(filename)) {
		if (!self._childDirs.hasOwnProperty(name)) 
			self._childDirs[name] = new LayoutNode(name, self._model, self);
		self._children.push(name);
	} else {
		self._children.unshift(name);
	}
}

LayoutNode.prototype.requestedHeight = function(pixelsPerLine, atY) {
	var self = this;
	var bottom_margin = 2;

	if (!self._model.isOpen(self.path())) {
		return FONT_DIR.height + bottom_margin;
	}

	var height = 0;

	self._children.forEach(function(name) {
		var dy = 0;
		if (self._model.isDir(self.childPath(name))) {
			var subdir = self._childDirs[name];
			if (height + atY < FONT_DIR.height && self._parent._parent) {
				dy = FONT_DIR.height - height - atY;
			}
			dy += subdir.requestedHeight(pixelsPerLine, atY + height);
		} else {
			dy = pixelsPerLine * self._model.visibleLineCount(self.childPath(name));
		}
		height += dy;
	});

	return (Math.max(height, FONT_DIR.height) + bottom_margin);
}

LayoutNode.prototype.layout = function() {
	var self = this;
	var y = 0;

	var lineCount = self._model.visibleLineCount(self.path());
	if (lineCount <= 0)
		return;
	var firstOrderPixelsPerLine = (self._dy)/lineCount;
	var y_adjust = 0;

	self._children.forEach(function(name) {
		var childLineCount = self._model.visibleLineCount(self.childPath(name));
		ASSERT(!isNaN(childLineCount));
		var dy = 0;
		
		if (self._model.isDir(self.childPath(name))) {
			var subdir = self._childDirs[name];
			if (y < FONT_DIR.height && self._parent) {
				y_adjust += FONT_DIR.height - y;
				y = FONT_DIR.height;
			}
			dy = subdir.requestedHeight(firstOrderPixelsPerLine, y);
			y_adjust += dy - (childLineCount * firstOrderPixelsPerLine);
		} else {
			dy = (childLineCount * firstOrderPixelsPerLine);
		}
		y += dy;
		ASSERT(!isNaN(y));
	});

	var pixelsPerLine = (self._dy - y_adjust) / lineCount;
	ASSERT(!isNaN(pixelsPerLine));

	y = 0;
	self._children.forEach(function(name) {
		var childLineCount = self._model.visibleLineCount(self.childPath(name));
		var childHeight = childLineCount * pixelsPerLine;

		if (self._childDirs.hasOwnProperty(name)) {
			var subdir = self._childDirs[name];
			if (y < FONT_DIR.height && self._parent) {
				y = FONT_DIR.height;
			}
			subdir.setClip(self._x + MARGIN, 
				y, 
				self._dx, 
				subdir.requestedHeight(pixelsPerLine, y));
			subdir.layout();
			self._layout[name] = {
				'y': y,
				'dy': subdir._dy
			};
			y += subdir._dy;
		} else {
			self._layout[name] = {
				'y': y,
				'dy': childLineCount * pixelsPerLine
			};
			y += childLineCount * pixelsPerLine;
		}
	});
}



LayoutNode.prototype.getParentDir = function(filename) {
	var self = this;
	if (!filename || !filename.length)
		return null;

	var parts = filename.split('/');

	if (parts.length == 1) {
		return self;
	} else if (self._childDirs.hasOwnProperty(parts[0])) {
		var name = parts.shift();
		return self._childDirs[name].getParentDir(parts.join('/'));
	}
	return null;
};


LayoutNode.prototype.getFileY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	ASSERT(parent);
	filename = filename.split('/').pop();
	if (parent == self) {
		ASSERT(self._layout[filename]);
		return self.y() + self._layout[filename].y;
	} else {
		return parent.getFileY(filename);
	}	
};

LayoutNode.prototype.getFileDY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	ASSERT(parent);
	filename = filename.split('/').pop();
	if (parent == self) {
		ASSERT(self._layout[filename]);
		return self._layout[filename].dy;
	} else {
		return parent.getFileDY(filename);
	}	
};

// absolute x relative to canvas
LayoutNode.prototype.x = function() {
	var self = this;
	return self._x + (self._parent ? self._parent.x() : 0);
};

// relative to parent
LayoutNode.prototype.setXoffset = function(x) {
	var self = this;
	self._x = x;
};

// absolute y relative to canvas
LayoutNode.prototype.y = function() {
	var self = this;
	var y = self._y  + (self._parent ? self._parent.y() : 0);
	return y;
};

// relative to parent
LayoutNode.prototype.setYoffset = function(y) {
	ASSERT(typeof(y) == 'number');
	ASSERT(!isNaN(y));
	var self = this;
	//console.log(self.path(), "Y:", y);
	self._y = y;
};

LayoutNode.prototype.setWidth = function(w) {
	ASSERT(typeof(w) == 'number');
	ASSERT(!isNaN(w));
	var self = this;
	return self._dx = w;
};

LayoutNode.prototype.setHeight = function(h) {
	ASSERT(typeof(h) == 'number');
	ASSERT(!isNaN(h));
	var self = this;
	return self._dy = h;
};

LayoutNode.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
	ASSERT(!isNaN(x));
	ASSERT(!isNaN(y));
	ASSERT(!isNaN(dx));
	ASSERT(!isNaN(dy));
	self._x = x;
	self._y = y;
	self._dx = dx;
	self._dy = dy;
	//LOG("relative setClip", self._name, x, y, dx, dy);
	//LOG("setClip", self._name, self.y(), dy);
}

function LOG() {
	console.log.apply(console, arguments);
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
