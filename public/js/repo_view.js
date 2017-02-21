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


var RepoView = function(context, width, height) {
	this._context = context;
	this._width = width;
	this._height = height;
	this._selectedFile = "";
	this._selectedCommitIndex = -1;
}

RepoView.prototype.setSelectedFile = function(file) {
	var self = this;

	if (file != self._selectedFile) {
		var previous = self._selectedFile;
		self._selectedFile = file;

		if (previous) {
			self.renderFileHistory(previous);
		}
		self.renderFileHistory(file);
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
			self.renderDiff(previous);
		}
		self.renderDiff(index);
	}
}

RepoView.prototype.setData = function(model, revList) {
	this._model = model;
	this._revList = revList;
	this._fromCommit = 0;
	this._toCommit = revList.length;
}

RepoView.prototype.setYLayout = function(layout) {
	this._layout = layout;
}

// in pixels
RepoView.prototype.fileYTop = function(filename) {
	var self = this;
	return self._layout[filename].y;
};

// in pixels
RepoView.prototype.fileYBottom = function(filename) {
	var self = this;
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



RepoView.prototype.render = function() {
	var self = this;

	Object.keys(self._layout).forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self.renderFileHistory(filename);
		}
	});
}

RepoView.prototype.renderFileHistory = function(filename) {
	var self = this;

	self.renderFilesizeHistory(filename);
	self.renderFileDiffs(filename);
}

RepoView.prototype.renderFilesizeHistory = function(filename) {
	var self = this;
	if (!self.isDrawn(filename)) {
		return;
	}

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);	
	var x = 0;
	var fileTop = self.fileYTop(filename);
	var maxFileHeight = self.fileHeight(filename);

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.fillRect(0, fileTop, self._width, maxFileHeight);
	if (filename === self._selectedFile) {
		self._context.fillStyle = "grey";
	} else {
		if(self._model.isDir(filename)) {
			self._context.fillStyle = COLORS.REPO_DIR
		} else {
			self._context.fillStyle = COLORS.REPO;
		}
	}

	for (var index=self._fromCommit; index <= self._toCommit; index++) {
		var dy = self.fileHeightAtCommit(filename, index);
		self._context.fillRect(x,
			fileTop,
			commit_width,
			dy
		);
		x += commit_width;
	};

};

// draw all diffs for all commits for a particular file
RepoView.prototype.renderFileDiffs = function(filename) {
	var self = this;
	if (!self.isDrawn(filename)) {
		return;
	}
	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self.renderFileDiff(index, filename);
	};
};

// draw all diffs in a particular commit
RepoView.prototype.renderDiff = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._revList.length) 
		return;

	var diff_summary = self._model.getDiffSummary(self._revList[diff_index]);
	if (diff_summary) {
		var files = {};
		Object.keys(self._layout).forEach(function(file) {
			files[file] = true;
		});

		Object.keys(diff_summary).forEach(function(filename) {
			if (files.hasOwnProperty(filename))
				self.renderFileDiff(diff_index, filename);
		});
	}
};

// diff:  // {commit:{}, diffs: {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
RepoView.prototype.renderFileDiff = function(diff_index, filename) { 
	var self = this;
	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);

	if (!diff_index < 0 || !diff_index >= self._revList.length) 
		return;

	var diff_summary = self._model.getDiffSummary(self._revList[diff_index]);

	self._context.fillStyle = self._model.isDir(filename) 
		? COLORS.DIFF_DIR
		: COLORS.DIFF;
	if (self._selectedCommitIndex == diff_index
		&& self._toCommit != self._fromCommit) {
		self._context.fillStyle = COLORS.DIFF_HIGHLIGHT;
	}

	var fileTop = self.fileYTop(filename);
	var fileHeight = self.fileHeight(filename);
	var x = commit_width * (diff_index - self._fromCommit);

	if (self._model.isDir(filename)) {
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
					fileHeight
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
				var dy =  (editLen*fileHeight)/fileLen;
				var y = fileTop + (linenum * fileHeight)/fileLen;

				self._context.fillRect(x,
					y,
					commit_width,
					dy
				);
			});
		}
	}
};