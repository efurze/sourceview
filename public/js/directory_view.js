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


var DirectoryView = {};

DirectoryView._root = null;
DirectoryView._selectedFile = "";

DirectoryView.init = function(context) {
	DirectoryView._root = new DirectoryViewNode("/", context, null);
};

DirectoryView.setClip = function(x,y,dx,dy) {
	DirectoryView._root.setClip(x,y,dx,dy);
};

DirectoryView.setModel = function(model) {
	DirectoryView._root.setModel(model);
};

DirectoryView.setSelectedFile = function(filename) {
	DirectoryView._selectedFile = filename;
};

DirectoryView.layout = function() {
	DirectoryView._root.layout();
};

DirectoryView.displayOrder = function() {
	return DirectoryView._root.displayOrder();
};

DirectoryView.getAll = function() {
	return DirectoryView._root.getAll();
};

DirectoryView.getFileY = function(filename) {
	return DirectoryView._root.getFileY(filename);
};

DirectoryView.getFileDY = function(filename) {
	return DirectoryView._root.getFileDY(filename);
};

DirectoryView.render = function() {
	DirectoryView._root.render();
	DirectoryView._renderSelectedFile();
};

DirectoryView.handleFilesClick = function(event) {
	return DirectoryView._root.handleFilesClick(event);
};


DirectoryView._renderSelectedFile = function() {
	if (DirectoryView._selectedFile.length) {
		var parent = DirectoryView._root.getParentDir(DirectoryView._selectedFile);
		if (parent) {
			var parts = DirectoryView._selectedFile.split('/');
			parent.renderSelected(parts[parts.length-1]);
		}
	}
};

/*=======================================================================================
=======================================================================================*/

var DirectoryViewNode = function(name, context, parent) {
	//LOG("New DirView", name);
	ASSERT(name.length);
	var self = this;
	self._parent = parent;
	self._context = context;
	self._name = name;
	self._childDirs = {};
	self._children = [];
	self._layout = {}; // filename: {y, dy}
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
	self._topMargin = 0;
};

DirectoryViewNode.prototype.path = function() {
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

DirectoryViewNode.prototype.childPath = function(name) {
	var self = this;
	var path = self.path();
	if (path.length) {
		path += '/';
	}
	return path + name;
}

DirectoryViewNode.prototype.displayOrder = function() {
	var self = this;
	var names = [];
	self._children.forEach(function(name) {
		var path = self.childPath(name);
		if (self._model.isDir(path)) {
			if (self._model.isOpen(path)) {
				names = names.concat(self._childDirs[name].displayOrder());
			} else {
				names.push(path);
			}
		} else {
			names.push(path);
		}
	});
	return names;
}

DirectoryViewNode.prototype.getAll = function() {
	var self = this;
	var names = [];
	self._children.forEach(function(name) {
		var path = self.childPath(name);
		names.push(path);
		if (self._model.isDir(path)) {
			names = names.concat(self._childDirs[name].displayOrder());
		}
	});
	return names;
}

DirectoryViewNode.prototype.setModel = function(model) {
	var self = this;
	var files = [];
	var dirs = [];
	self._childDirs = {};
	self._children = [];
	self._model = model;
	model.getChildren(self.path()).forEach(function(child) {
		if (!child || !child.length)
			return;
		var parts = child.split('/');
		var name = parts[parts.length-1];
		if (model.isDir(child)) {
			self._childDirs[name] = new DirectoryViewNode(name, self._context, self);
			self._childDirs[name].setModel(model);
			dirs.push(name);
		} else {
			files.push(name);
		}
	});

	self._children = files.concat(dirs);
//	self._children.sort(function (a, b) {
//		return a.toLowerCase().localeCompare(b.toLowerCase());
//	});
}

DirectoryViewNode.prototype.requestedHeight = function(pixelsPerLine, atY) {
	var self = this;

	if (!self._model.isOpen(self.path())) {
		return FONT_DIR.height;
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

	return Math.max(height, FONT_DIR.height);
}

DirectoryViewNode.prototype.layout = function() {
	var self = this;
	var y = 0;

	var lineCount = self._model.visibleLineCount(self.path());
	var firstOrderPixelsPerLine = self._dy/lineCount;
	var y_adjust = 0;

	self._children.forEach(function(name) {
		var childLineCount = self._model.visibleLineCount(self.childPath(name));
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
	});

	var pixelsPerLine = (self._dy - y_adjust) / lineCount;

	y = 0;
	self._children.forEach(function(name) {
		var childLineCount = self._model.visibleLineCount(self.childPath(name));
		var childHeight = childLineCount * pixelsPerLine;

		if (self._model.isDir(self.childPath(name))) {
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



DirectoryViewNode.prototype.handleFilesClick = function(event) {
	var self = this;
	//console.log("click", event.offsetY);
	var handled = false;

	if (self._model.isDir(self.path())) {
		if (self._model.isOpen(self.path())) {
			var subdirs = Object.keys(self._childDirs);
			var index = 0;
			while (!handled && index < subdirs.length) {
				handled = self._childDirs[subdirs[index]].handleFilesClick(event);
				index ++;
			}
		}

		if (!handled) {
			var y = self.y();
			if (event.offsetY >= y && event.offsetY <= (y + FONT_DIR.height)) {
				//console.log("event handled by", self._name);
				handled = true;
				self._model.toggleOpen(self._name);
			}
		}
	}

	return handled;
};





DirectoryViewNode.prototype.render = function() {
	var self = this;
	var x = self.x();
	var y = self.y();

	// our name
	if (self._parent) { // don't draw root dir
		if (self._model.isDir(self.path())) {
			var selectedFile = DirectoryView._selectedFile;
			var selectedDir = self._model.isDir(selectedFile)
				? selectedFile 
				: self._model.getParent(selectedFile);

			var handle = self._model.isOpen(self.path()) ? '- ' : '+ ';
			self._renderText(handle + self._name + '/', 
				x, y, 
				FONT_DIR, 
				self.path() === selectedDir
			);
		}
	}

	if (self._model.isOpen(self.path())) {
		// children
		Object.keys(self._childDirs).forEach(function(name) {
			var child = self._childDirs[name];
			if (self._model.isDir(self.childPath(name))) {
				child.render();
			}
		});
	}

}

DirectoryViewNode.prototype.renderSelected = function(childname) {
	var self = this;
	if (!self._layout.hasOwnProperty(childname)
		|| self._childDirs.hasOwnProperty(childname))
		return;

	var font = FONT_NORMAL;	
	var context = self._context;
	context.font = font.name;

	var y = self.getFileY(childname);
	var x = self._dx - context.measureText(childname).width - 2*MARGIN;

	context.beginPath();
	context.fillStyle = FILES_BACKGROUND_COLOR;
	context.fillRect(x, y, self._dx, font.height);
	context.beginPath();
	context.fillStyle = font.color;
	context.fillText(childname, x, y + font.height);
}


DirectoryViewNode.prototype._renderText = function(text, x, y, font, selected) {
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


DirectoryViewNode.prototype.getParentDir = function(filename) {
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


DirectoryViewNode.prototype.getFileY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	filename = filename.split('/').pop();
	if (parent == self) {
		return self.y() + self._layout[filename].y;
	} else {
		return parent.getFileY(filename);
	}	
};

DirectoryViewNode.prototype.getFileDY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	filename = filename.split('/').pop();
	if (parent == self) {
		return self._layout[filename].dy;
	} else {
		return parent.getFileDY(filename);
	}	
};

// absolute x relative to canvas
DirectoryViewNode.prototype.x = function() {
	var self = this;
	return self._x + (self._parent ? self._parent.x() : 0);
};

// relative to parent
DirectoryViewNode.prototype.setXoffset = function(x) {
	var self = this;
	self._x = x;
};

// absolute y relative to canvas
DirectoryViewNode.prototype.y = function() {
	var self = this;
	var y = self._y  + (self._parent ? self._parent.y() : 0);
	return y;
};

// relative to parent
DirectoryViewNode.prototype.setYoffset = function(y) {
	ASSERT(typeof(y) == 'number');
	ASSERT(!isNaN(y));
	var self = this;
	//console.log(self.path(), "Y:", y);
	self._y = y;
};

DirectoryViewNode.prototype.setWidth = function(w) {
	ASSERT(typeof(w) == 'number');
	ASSERT(!isNaN(w));
	var self = this;
	return self._dx = w;
};

DirectoryViewNode.prototype.setHeight = function(h) {
	ASSERT(typeof(h) == 'number');
	ASSERT(!isNaN(h));
	var self = this;
	return self._dy = h;
};

DirectoryViewNode.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
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
