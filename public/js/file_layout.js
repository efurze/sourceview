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

var node_index = {};


var Layout = function(model, revList) {
	this._root = new LayoutNode("/", model, revList);
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
	console.log("add", filename);
	applyParent(filename, "addFile");
};

Layout.prototype.layout = function(from, to) {
	ASSERT(this._root);
	this._root.layout(from, to);
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
	return applyParent(filename, "getFileY");
};

Layout.prototype.getFileDY = function(filename) {
	return applyParent(filename, "getFileDY");
};


Layout.prototype.fileMaxSize = function(filename) {
	return applyParent(filename, "fileMaxSize");

};

function applyParent(filename, fn){
	var parts = parsePath(filename);
	var parent = node_index[parts.parent];
	ASSERT(parent);
	if (parent) {
		return parent[fn](parts.name);
	}
}

function parsePath(path) {
	var ret = {};
	var parts = path.split('/');
	ret.name = parts.pop();
	ret.parent = parts.join('/');
	return ret;
}

/*=======================================================================================
=======================================================================================*/

var LayoutNode = function(name, model, revList, parent) {
	ASSERT(name.length);
	var self = this;
	self._parent = parent;
	self._revList = revList;
	self._model = model;
	self._name = name;
	self._childDirs = {};
	self._children = [];
	self._layout = {}; // filename: {y, dy}
	self._fromCommit = -1;
	self._toCommit = -1;
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;

	node_index[self.path()] = self;
	console.log("dir", self.path());
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
LayoutNode.prototype.addFile = function(name) {
	var self = this;

	var path = self.childPath(name);
	if (self._model.isDir(path)) {
		if (!self._childDirs.hasOwnProperty(name)) 
			self._childDirs[name] = new LayoutNode(name, self._model, self._revList, self);
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
			dy = pixelsPerLine * self.fileMaxSize(name);
		}
		height += dy;
	});

	return (Math.max(height, FONT_DIR.height) + bottom_margin);
}

LayoutNode.prototype.layout = function(from, to) {
	var self = this;
	ASSERT(to < self._revList.length);
	if (self._fromCommit != from || self._toCommit != to) {
		self._calculateRange(from, to);
	}
	var y = 0;


	var lineCount = self.visibleLineCount();
	if (lineCount <= 0)
		return;
	var firstOrderPixelsPerLine = (self._dy)/lineCount;
	var y_adjust = 0;

	self._children.forEach(function(name) {
		var childLineCount;
		var dy = 0;
		
		if (self._childDirs.hasOwnProperty(name)) {
			childLineCount = self._childDirs[name].visibleLineCount();
			var subdir = self._childDirs[name];
			if (y < FONT_DIR.height && self._parent) {
				y_adjust += FONT_DIR.height - y;
				y = FONT_DIR.height;
			}
			dy = subdir.requestedHeight(firstOrderPixelsPerLine, y);
			y_adjust += dy - (childLineCount * firstOrderPixelsPerLine);
		} else {
			childLineCount = self.fileMaxSize(name);
			dy = (childLineCount * firstOrderPixelsPerLine);
		}
		y += dy;
		ASSERT(!isNaN(y));
	});

	var pixelsPerLine = (self._dy - y_adjust) / lineCount;
	ASSERT(!isNaN(pixelsPerLine));

	y = 0;
	self._children.forEach(function(name) {
		var childLineCount;

		if (self._childDirs.hasOwnProperty(name)) {
			childLineCount = self._childDirs[name].visibleLineCount;
			var subdir = self._childDirs[name];
			if (y < FONT_DIR.height && self._parent) {
				y = FONT_DIR.height;
			}
			subdir.setClip(self._x + MARGIN, 
				y, 
				self._dx, 
				subdir.requestedHeight(pixelsPerLine, y));
			subdir.layout(from, to);
			self._layout[name] = {
				'y': y,
				'dy': subdir._dy
			};
			y += subdir._dy;
		} else {
			childLineCount = self.fileMaxSize(name);
			self._layout[name] = {
				'y': y,
				'dy': childLineCount * pixelsPerLine
			};
			y += childLineCount * pixelsPerLine;
		}
	});
}

LayoutNode.prototype._calculateRange = function(from, to) {
	var self = this;
	ASSERT(to < self._revList.length);

	self._range = {};
	self._childLines = 0
	self._children.forEach(function(filename){
		if (self._childDirs[filename]) {
			self._childDirs[filename]._calculateRange(from, to);
		} else {
			var max = 0;
			for (var i=from; i<=to; i++) {
				max = Math.max(max,
								self._model.fileSize(self.childPath(filename), 
													self._revList[i])
								);
			}
			self._range[filename] = max;
			self._childLines += max;
		}
	});
}

LayoutNode.prototype.visibleLineCount = function() {
	var self = this;
	var total = 0;
	if (self._model.isOpen(self.path())) {
		total = self._childLines;
		Object.keys(self._childDirs).forEach(function(name) {
			total += self._childDirs[name].visibleLineCount();
		});
	}
	return total;
}

LayoutNode.prototype.fileMaxSize = function(filename) {
	var self = this;
	ASSERT(self._range.hasOwnProperty(filename));
	return self._range[filename];
}



LayoutNode.prototype.getFileY = function(filename) {
	var self = this;
	if(self._layout[filename])
		return self.y() + self._layout[filename].y;
	else 
		return self.y();	
};

LayoutNode.prototype.getFileDY = function(filename) {
	var self = this;
	if(self._layout[filename])
		return self._layout[filename].dy;
	else 
		return 0;	
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
