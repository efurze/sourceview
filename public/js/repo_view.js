'use strict'

var COLORS = {
 FILES_BACKGROUND: 	'#F0DAA4', 	// goldenrod
 REPO_BACKGROUND: 	'#A2BCCD', 	// light blue
 REPO: 				'#8296A4', 	// medium blue
 DIFF: 				'#424D54',	// blue-black
 DIFF_HIGHLIGHT: 	'#FFFFD5',	// light yellow 

 REPO_DIR: 			'#686a83', 	// 
 DIFF_DIR: 			'#414252',	// 
};

var MARGIN = 5;

var FONT_NORMAL = {
	'name': '8px Helvetica',
	'height': 8,
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


var RepoView = function(context) {
	this._context = context;
	this._width = 0;
	this._height = 0;
	this._selectedFile = "";
	this._selectedCommitIndex = -1;
	this._dirtyFiles = {};
	this._dirtyCommits = {};
}

RepoView.prototype.setClip = function(x, y, dx, dy) {
	this._x = x;
	this._y = y;
	this._width = dx;
	this._height = dy;
}

RepoView.prototype.markFile = function(file) {
	var self = this;
	self._dirtyFiles[file] = true;
}

RepoView.prototype.markCommit = function(commit) {
	var self = this;
	self._dirtyCommits[commit] = true;
}

RepoView.prototype.setSelectedFile = function(file) {
	var self = this;

	if (file != self._selectedFile) {
		var previous = self._selectedFile;
		self._selectedFile = file;

		if (previous) {
			self.markFile(previous)
		}
		self.markFile(file);
		self.render();
	}
}

RepoView.prototype.setSelectedCommit = function(index) {
	var self = this;

	if (index != self._selectedCommitIndex) {
		var previous = self._selectedCommitIndex;
		var msg = "";
		self._selectedCommitIndex = index;
		if (index >= 0 && index < self._revList.length) {
			msg = "[" + self._model.getCommitDate(self._revList[index]) + "]: ";
			msg += self._model.getCommitMsg(self._revList[self._selectedCommitIndex]);
		}
		$("#commit_info").text(msg);
		
		if (previous >= 0) {
			self.markCommit(previous);
		}
		self.markCommit(index);
		self.render();
	}
}

RepoView.prototype.setData = function(model, revList) {
	this._model = model;
	this._revList = revList;
	this._fromCommit = 0;
	this._toCommit = revList.length;
}

RepoView.prototype.setYLayout = function(layout) {
	var self = this;
	self._layout = layout;
	Object.keys(self._layout).forEach(function(filename) {
		self.markFile(filename);
	});
}

// in pixels
RepoView.prototype.fileYTop = function(filename) {
	var self = this;
	ASSERT(self._layout.hasOwnProperty(filename));
	return self._layout[filename].y;
};

// in pixels
RepoView.prototype.fileYBottom = function(filename) {
	var self = this;
	ASSERT(self._layout.hasOwnProperty(filename));
	return self.fileYTop(filename) + self.fileHeight(filename);
};

// in pixels
RepoView.prototype.fileHeight = function(filename) {
	var self = this;
	return self._layout[filename].dy;
};

// in pixels
// @commit_index = index into self._history
RepoView.prototype.fileHeightAtCommit = function(filename, commit_index) {
	var self = this;
	if (self._model.isDir(filename)) {
		return FONT_DIR.height;
	} else {
		return  self._model.fileSize(filename, self._revList[commit_index]) 
		 	* self.fileHeight(filename) / self._model.fileMaxSize(filename);
	}
};

RepoView.prototype.isDrawn = function(filename) {
	var self = this;
	if (!self._model.isVisible(filename)) {
		return false;
	}
	if (self._model.isDir(filename) && self._model.isOpen(filename)) {
		return false;
	}
	return true;
}

RepoView.prototype.isDescendantOf = function(filename, dir) {
	var self = this;
	return filename.startsWith(dir);
}


RepoView.prototype.render = function() {
	var self = this;

	Object.keys(self._dirtyFiles).forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self._renderFile(filename);
			delete self._dirtyFiles[filename];
		}
	});

	Object.keys(self._dirtyCommits).forEach(function(index) {
		self._renderCommit(index);
		delete self._dirtyCommits[index];
	});
}

// draw a column
RepoView.prototype._renderCommit = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._revList.length) 
		return;

	Object.keys(self._layout).forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self._renderCell(filename, diff_index);
		}
	})
};

// draw a row
RepoView.prototype._renderFile = function(filename) {	
	var self = this;
	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self._renderCell(filename, index);
	};
}


RepoView.prototype._renderCell = function(filename, diff_index) {	
	var self = this;

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);	
	var x = commit_width * (diff_index - self._fromCommit);
	var fileTop = self.fileYTop(filename);
	var maxFileHeight = self.fileHeight(filename);

	// size
	self._context.beginPath();
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.fillRect(x,
		fileTop,
		commit_width,
		maxFileHeight
	);
	if (filename === self._selectedFile) {
		self._context.fillStyle = "grey";
	} else {
		if(self._model.isDir(filename)) {
			self._context.fillStyle = COLORS.REPO_DIR
		} else {
			self._context.fillStyle = COLORS.REPO;
		}
	}

	self._context.beginPath();
	var dy = self.fileHeightAtCommit(filename, diff_index);
	self._context.fillRect(x,
		fileTop,
		commit_width,
		dy
	);

	// diff
	var diff_summary = self._model.getDiffSummary(self._revList[diff_index]);
	self._context.fillStyle = self._model.isDir(filename) 
		? COLORS.DIFF_DIR
		: COLORS.DIFF;
	if (self._selectedCommitIndex == diff_index
		&& self._toCommit != self._fromCommit) {
		self._context.fillStyle = COLORS.DIFF_HIGHLIGHT;
	}


	if (self._model.isDir(filename) && diff_summary) {
		var changed_files = Object.keys(diff_summary);
		var mark_commit = false;
		for (var i=0; i < changed_files.length; i++) {
			if (self.isDescendantOf(changed_files[i], filename)) {
				mark_commit = true;
				break;
			}
		}
		if (mark_commit) {
			self._context.fillRect(x,
					fileTop,
					commit_width,
					maxFileHeight
				);
		}
	} else {
		var fileLen = self._model.fileMaxSize(filename);

		if (diff_summary && diff_summary.hasOwnProperty(filename)) {
			var edits = diff_summary[filename];

			edits.forEach(function(edit) { // "+1,9"
				var parts = edit.split(",");
				var linenum = parseInt(parts[0].slice(1));
				var editLen = parseInt(parts[1]);
				var dy =  (editLen*maxFileHeight)/fileLen;
				var y = fileTop + (linenum * maxFileHeight)/fileLen;

				self._context.fillRect(x,
					y,
					commit_width,
					dy
				);
			});
		}
	}
}




function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}


