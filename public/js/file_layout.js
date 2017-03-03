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
	this._revList = revList;
	this._listeners = [];
	this._fromCommit = -1;
	this._toCommit = -1;
}

Layout.prototype.addListener = function(cb) {
	this._listeners.push(cb);
}

Layout.prototype.setClip = function(x,y,dx,dy) {
	ASSERT(this._root);
	this._root.setClip(x,y,dx,dy);
};

Layout.prototype.layout = function(from, to) {
	var self = this;
	ASSERT(self._root);

	self.updateFileList(from, to);

	self._root.layout(from, to);
	self._listeners.forEach(function(cb) {
		cb();
	});
};

Layout.prototype.closeAll = function() {
	ASSERT(this._root);
	this._root.closeAll();
};

// returns full path of parent dir
Layout.prototype.getParent = function(path) {
	return parsePath(path).parent;
}

Layout.prototype.isVisible = function(path) {
	var parts = parsePath(path);
	ASSERT(node_index[parts.parent]);
	if (node_index[parts.parent]) {
		return node_index[parts.parent].isOpen();
	}
}

Layout.prototype.isOpen = function(path) {
	ASSERT(node_index[path]);
	if (node_index[path]) {
		return node_index[path].isOpen();
	}
}

Layout.prototype.toggleOpen = function(path) {
	ASSERT(node_index[path]);
	if (node_index[path]) {
		node_index[path].setOpen(!node_index[path].isOpen());
	}
}

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

Layout.prototype.isDir = function(filename) {
	return isDir(filename);
};


Layout.prototype.fileMaxSize = function(filename) {
	return applyParent(filename, "fileMaxSize");
};

Layout.prototype._addFile = function(filename) {
	var parts = parsePath(filename);
	if (!node_index[parts.parent]) {
		this._addDir(parts.parent);
	}
	ASSERT(node_index[parts.parent]);
	node_index[parts.parent].addFile(parts.name);
};

Layout.prototype._addDir = function(filename) {
	var self = this;
	var parts = parsePath(filename);
	if (!node_index[parts.parent]) {
		self._addDir(parts.parent);
	}
	ASSERT(node_index[parts.parent]);
	node_index[filename] = new LayoutNode(parts.name,
										self._model,
										self._revList,
										node_index[parts.parent]);
	node_index[parts.parent].addFile(parts.name);
};

/*
	ensures that we have an entry for every file 
	in all commits between <from> and <to>
*/
Layout.prototype.updateFileList = function(from, to) {
	var self = this;
	if (from != self._fromCommit || to != self._toCommit) {
		self._fromCommit = from;
		self._toCommit = to;
		for (var i=from; i<=to; i++) {
			var sha = self._revList[i];
			Object.keys(self._model.fileSizes(sha)).forEach(function(path) {
				self._addFile(path);
			});
		}
	}
}

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
	if (!ret.parent.length && ret.name !== '/')
		ret.parent = '/';
	return ret;
}

function isDir(filename) {
	return node_index.hasOwnProperty(filename);
};

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
	self._childHash = {};
	self._layout = {}; // filename: {y, dy}
	self._fromCommit = -1;
	self._toCommit = -1;
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
	self._isOpen = true;

	if (self.isRoot()) {
		node_index[self._name] = self;
	} else {
		node_index[self.path()] = self;
	}
};

LayoutNode.prototype.displayOrder = function() {
	var self = this;
	var names = [];
	self._children.forEach(function(name) {
		var path = self.childPath(name);
		names.push(path);
		if (self._childDirs[name]) {
			if (self._childDirs[name].isOpen()) {
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
	if (self._isOpen) {
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
		self._isOpen = false;
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

	if (self._childHash.hasOwnProperty(name))
		return;

	var path = self.childPath(name);
	if (isDir(path)) {
		if (!self._childDirs.hasOwnProperty(name)) 
			self._childDirs[name] = node_index[path];
		self._children.push(name);
	} else {
		self._children.unshift(name);
	}

	self._childHash[name] = true;
}

LayoutNode.prototype.requestedHeight = function(pixelsPerLine, atY) {
	var self = this;
	var bottom_margin = 2;

	if (!self._isOpen) {
		return FONT_DIR.height + bottom_margin;
	}

	var height = 0;

	self._children.forEach(function(name) {
		var dy = 0;
		if (self._childDirs.hasOwnProperty(name)) {
			var subdir = self._childDirs[name];
			ASSERT(subdir);
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
		self._setRange(from, to);
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

LayoutNode.prototype._setRange = function(from, to) {
	var self = this;
	ASSERT(to < self._revList.length);

	self._range = {};
	self._childLines = 0
	self._children.forEach(function(filename){
		if (self._childDirs[filename]) {
			self._childDirs[filename]._setRange(from, to);
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
	if (self._isOpen) {
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

LayoutNode.prototype.setOpen = function(open) {
	this._isOpen = open;
}

LayoutNode.prototype.isOpen = function() {
	return this._isOpen;
}

function LOG() {
	console.log.apply(console, arguments);
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
