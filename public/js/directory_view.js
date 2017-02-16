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
var DirectoryView = function(name, parent) {
	LOG("New DirView", name);
	var self = this;
	self._parent = parent;
	self._name = name;
	self._childDirs = {};
	self._children = [];
	self._childHash = {};
	self._x = 0;
	self._y = 0;
	self._dx = 0;
	self._dy = 0;
	self._topMargin = 0;
};

DirectoryView.prototype.path = function() {
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

DirectoryView.prototype.childPath = function(name) {
	var self = this;
	var path = self.path();
	if (path.length) {
		path += '/';
	}
	return path + name;
}

DirectoryView.prototype.setModel = function(model) {
	var self = this;
	self._childDirs = {};
	self._children = [];
	self._model = model;
	model.getChildren(self.path()).forEach(function(child) {
		var parts = child.split('/');
		var name = parts[parts.length-1];
		if (model.isDir(child)) {
			self._childDirs[name] = new DirectoryView(name, self);
			self._childDirs[name].setModel(model);
		}
		self._children.push(name);
		self._childHash[name] = true;
	});

	self._children.sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});
}

DirectoryView.prototype.layout = function() {
	var self = this;
	var y = 0;
	var lineCount = self._model.visibleLineCount(self.path());

	self._children.forEach(function(name) {
		var childLineCount = self._model.visibleLineCount(self.childPath(name));
		var dy = (childLineCount * self._dy) / lineCount;
		if (!self._model.isOpen(self.childPath(name))) {
			dy = 0;
		}
		if (self._model.isDir(self.childPath(name))) {
			var child = self._childDirs[name];
			child.setClip(self._x + MARGIN, y, self._dx, dy);
			child.layout();
			y += child._dy;
		} else {
			y += dy;
		}
	});


	var lastY = 0;
	if (!self._parent) {
		lastY = -100;
	}
	var lastChild = null;
	self._children.forEach(function(name) {
		if (self._model.isDir(self.childPath(name))) {
			var child = self._childDirs[name];
			y = child._y;
			if (y < lastY + FONT_NORMAL.height) {
				var delta = lastY + FONT_NORMAL.height - y;
				//LOG("adjust", name,"by", delta);
				child._y += delta;
				if (lastChild) {
					lastChild._dy += delta;
				}
			}
			if (!self._model.isOpen(self.childPath(name))) {
				child._dy = FONT_NORMAL.height;
			}
			lastY = child._y;
			lastChild = child;
		}
	});

}



DirectoryView.prototype.handleFilesClick = function(event) {
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
			if (event.offsetY >= y && event.offsetY <= (y + FONT_NORMAL.height)) {
				//console.log("event handled by", self._name);
				handled = true;
				self._model.toggleOpen(self._name);
			}
		}
	}

	return handled;
};





DirectoryView.prototype.renderDirectories = function(context) {
	var self = this;
	var x = self.x();
	var y = self.y();

	//context.save();
	//context.beginPath();
	//context.rect(x, y, self._dx, self._dy);
	//context.clip();

	//LOG(self._name, x, y, self._dx, self._dy);

	// our name
	if (self._parent) { // don't draw root dir
		if (self._model.isDir(self.path())) {
			var handle = self._model.isOpen(self.path()) ? '- ' : '+ ';
			self._renderText(handle + self._name + '/', x, y, FONT_NORMAL, context);
		}
	}

	if (self._model.isOpen(self.path())) {
		// children
		Object.keys(self._childDirs).forEach(function(name) {
			var child = self._childDirs[name];
			if (self._model.isDir(self.childPath(name))) {
				child.renderDirectories(context);
			}
		});
	}

	//context.restore();
}


DirectoryView.prototype._renderText = function(text, x, y, font, context) {
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


DirectoryView.prototype.getParentDir = function(filename) {
	var self = this;
	var parts = filename.split('/');
	if (parts.length == 1 && self._childHash.hasOwnProperty(parts[0])) {
		return self;
	} else if (self._childDirs.hasOwnProperty(parts[0])) {
		var name = parts.shift();
		return self._childDirs[name].getParentDir(parts.join('/'));
	}
};


DirectoryView.prototype.getFileY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	filename = filename.split('/').pop();
	if (parent == self) {
		var lines_dy = 0;
		for(var i=0; i < self._children.length; i++) {
			if (self._children[i] === filename) {
				break;
			} else {
				lines_dy += self._model.visibleLineCount(
					self.childPath(self._children[i]));
			}
		}

		var y = self.y() + (self._dy * lines_dy / self._model.visibleLineCount(self.path()));
		return y;
	} else {
		return parent.getFileY(filename);
	}	
};

DirectoryView.prototype.getFileDY = function(filename) {
	var self = this;
	var parent = self.getParentDir(filename);
	filename = filename.split('/').pop();
	if (parent == self) {
		var lines_dy = 0;
		for(var i=0; i < self._children.length; i++) {
			if (self._children[i] === filename) {
				break;
			} else {
				lines_dy += self._model.visibleLineCount(
					self.childPath(self._children[i]));
			}
		}

		var y = self._dy * self._model.visibleLineCount(self.childPath(filename)) / self._model.visibleLineCount(self.path());
		return y;
	} else {
		return parent.getFileDY(filename);
	}	
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
	var y = self._y  + (self._parent ? self._parent.y() : 0);
	return y;
};

// relative to parent
DirectoryView.prototype.setYoffset = function(y) {
	ASSERT(typeof(y) == 'number');
	ASSERT(!isNaN(y));
	var self = this;
	//console.log(self.path(), "Y:", y);
	self._y = y;
};

DirectoryView.prototype.setWidth = function(w) {
	ASSERT(typeof(w) == 'number');
	ASSERT(!isNaN(w));
	var self = this;
	return self._dx = w;
};

DirectoryView.prototype.setHeight = function(h) {
	ASSERT(typeof(h) == 'number');
	ASSERT(!isNaN(h));
	var self = this;
	return self._dy = h;
};

DirectoryView.prototype.setClip = function(x,y,dx,dy) {
	var self = this;
	self._x = x;
	self._y = y;
	self._dx = dx;
	self._dy = dy;
	//LOG("relative setClip", self._name, x, y, dx, dy);
	LOG("setClip", self._name, self.y(), dy);
}

function LOG() {
	console.log.apply(console, arguments);
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
