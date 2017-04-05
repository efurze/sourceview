'use strict'

let rect_count = 0;

var RepoView = function(context, model, layout, revList) {
	var self = this;
	this._context = context;
	this._revList = revList;
	this._width = 0;
	this._height = 0;
	this._highlightedFile = "";
	this._highlightedCommitIndex = -1;
	this._dirtyFiles = {};
	this._dirtyFilesAry = [];
	this._dirtyCommits = {};
	this._dirtyCommitsAry = [];
	this._revIndex = {};
	this._authorColors = {};
	this._isSelected = false;
	this._layoutModel = layout;
	this._model = model;
	this._layout = {};

	layout.on('layout', this.layoutChanged.bind(this));

	revList.forEach(function(sha, index) {
		self._revIndex[sha] = index;
	});
}

RepoView.prototype.setClip = function(x, y, dx, dy) {
	Logger.DEBUG("setClip", x, y, dx, dy, Logger.CHANNEL.REPO_VIEW);
	this._x = x;
	this._y = y;
	this._width = dx;
	this._height = dy;
}

RepoView.prototype.getClipX = function() {
	return this._x;
}

RepoView.prototype.getClipDX = function() {
	return this._width;
}

RepoView.prototype.markFile = function(file) {
	var self = this;
	if (!self._dirtyFiles.hasOwnProperty(file)) {
		self._dirtyFiles[file] = true;
		self._dirtyFilesAry.push(file);
	}
}

RepoView.prototype.markCommit = function(commit_sha) {
	var self = this;
	if (!self._dirtyCommits.hasOwnProperty(commit_sha)) {
		self._dirtyCommits[commit_sha] = true;
		self._dirtyCommitsAry.push(commit_sha);
	}
}

RepoView.prototype.markAll = function() {
	Logger.DEBUG("markAll", Logger.CHANNEL.REPO_VIEW);
	var self = this;
	for(var i=self._fromCommit; i<=self._toCommit; i++) {
		self.markCommit(self._revList[i]);
	}
}

RepoView.prototype.layoutChanged = function() {
	var self = this;
	Logger.DEBUG("layoutChanged", Logger.CHANNEL.REPO_VIEW);
	self._layout = self._layoutModel.getLayout();
	self.markAll();
}

RepoView.prototype.setSelected = function(isSelected) {
	var self = this;
	self._isSelected = isSelected;
	self.markFile(self._highlightedFile);
}

RepoView.prototype.setHighlightedFile = function(file) {
	var self = this;

	if (file != self._highlightedFile) {
		var previous = self._highlightedFile;
		self._highlightedFile = file;

		if (previous) {
			self.markFile(previous)
		}
		self.markFile(file);
		self.render();
	}
}

RepoView.prototype.getHighlightedFile = function() {
	return this._highlightedFile;
}


RepoView.prototype.setHighlightedCommit = function(index) {
	var self = this;

	if (index != self._highlightedCommitIndex) {
		var previous = self._highlightedCommitIndex;
		var msg = "";
		self._highlightedCommitIndex = index;
		if (index >= 0 && index < self._revList.length) {
			msg = "[" + self._model.getCommitDate(self._revList[index]) + "]: ";
			msg += self._model.getCommitMsg(self._revList[self._highlightedCommitIndex]);
		}
		$("#commit_info").text(msg);
		
		if (previous >= 0) {
			self.markCommit(self._revList[previous]);
		}
		self.markCommit(self._revList[index]);
		self.render();
	}
}

RepoView.prototype.getHighlightedCommit = function() {
	return this._highlightedCommitIndex;
}

RepoView.prototype.setCommitRange = function(from, to) {
	var self = this;
	to = Math.min(to, self._revList.length-1);
	from = Math.max(from, 0);

	// dirty the newly visible commits
	if (to > self._toCommit) {
		var start = Math.max(self._toCommit, from);
		for (var i=start; i <= to; i++) {
			self.markCommit(self._revList[i]);
		}
	} else if (from < self._fromCommit) {
		var end = Math.min(self._fromCommit, to);
		for (var i=from; i <= end; i++) {
			self.markCommit(self._revList[i]);	
		}
	}

	Logger.DEBUG("setRange", from, "=>", to, Logger.CHANNEL.REPO_VIEW);

	self._fromCommit = from;
	self._toCommit = to;
}



// in pixels
RepoView.prototype.fileYTop = function(filename) {
	var self = this;
	ASSERT(self._layout.hasOwnProperty(filename));
	return self._layout[filename].y;
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
	if (self._layoutModel.isDir(filename)) {
		return self.fileHeight(filename);
	} else {
		let len = self._layoutModel.fileMaxSize(filename);
		if (len < 0) {
			if (self._model.fileSize(filename, self._revList[commit_index]) > 0)
				return self.fileHeight(filename);
			else 
				return 0;
		} else {
			return  self._model.fileSize(filename, self._revList[commit_index]) 
			 	* self.fileHeight(filename) / len;
		}
	}
};


RepoView.prototype.isDescendantOf = function(filename, dir) {
	var self = this;
	return filename.startsWith(dir);
}


RepoView.prototype.render = function() {
	var self = this;

	if (self._dirtyCommitsAry.length)
		requestAnimationFrame(self._renderCommits.bind(self));
	
	if (self._dirtyFilesAry.length)
		requestAnimationFrame(self._renderFiles.bind(self));
}

RepoView.prototype._renderFiles = function() {
	var self = this;
	Logger.DEBUGHI("renderFiles", self._dirtyFilesAry.length, Logger.CHANNEL.REPO_VIEW);
	rect_count = 0;
	//console.time("repo render");

	self._commit_width = self._width/(self._toCommit - self._fromCommit + 1);	

	if (self._dirtyFilesAry.length) {
		var filename = self._dirtyFilesAry.shift();
		delete self._dirtyFiles[filename];
		if (self._layoutModel.isVisible(filename)) {
			self._renderFile(filename);
		}
	}

	//console.log(rect_count);
	//console.timeEnd("repo render");

	self.render();
}

RepoView.prototype._renderCommits = function() {
	var self = this;
	Logger.DEBUGHI("renderCommits", self._dirtyCommitsAry.length, Logger.CHANNEL.REPO_VIEW);
	rect_count = 0;
	var startTime = Date.now();
	//console.time("repo render");

	self._commit_width = self._width/(self._toCommit - self._fromCommit + 1);	

	while ((Date.now() - startTime) < 200 && self._dirtyCommitsAry.length) {
		var sha = self._dirtyCommitsAry.shift();
		delete self._dirtyCommits[sha];
		self._renderCommit(self._revIndex[sha]);
	}

	//console.log(rect_count);
	//console.timeEnd("repo render");

	self.render();
}

// draw a column
RepoView.prototype._renderCommit = function(diff_index) { 
	var self = this;
	if (diff_index < self._fromCommit || diff_index > self._toCommit) 
		return;

	
	Logger.DEBUGHI("Drawing commit", 
		diff_index, 
		self._revList[diff_index],
		"at column", 
		diff_index - self._fromCommit,
		Logger.CHANNEL.REPO_VIEW);

	self._clearColumn(diff_index);
	const files = Object.keys(self._layout);
	let i, filename;
	for (i=0; i < files.length; i++) {
		filename = files[i];
		if (self._layoutModel.isVisible(filename)) {
			self._renderCell(filename, diff_index);
		}
	}
};

RepoView.prototype._clearColumn = function(diff_index) { 
	var self = this;
	var x = self._commit_width * (diff_index - self._fromCommit);
	self._context.beginPath();
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._fillRect(x,
		self._y,
		self._commit_width,
		self._height
	);

}

// draw a row
RepoView.prototype._renderFile = function(filename) {	
	var self = this;
	if (!self._layout.hasOwnProperty(filename)) {
		return;
	}
	//LOG("renderFile", filename);

	Logger.DEBUG("Drawing file", 
		filename, 
		"at y", 
		self.fileYTop(filename),
		Logger.CHANNEL.REPO_VIEW);

	if (!self._layoutModel.isDir(filename))
		self._clearRow(filename);
	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self._renderCell(filename, index);
	}
}


RepoView.prototype._clearRow = function(filename) { 
	var self = this;

	self._context.beginPath();
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._fillRect(0,
		self.fileYTop(filename),
		self._width,
		self.fileHeight(filename)
	);
}

RepoView.prototype._renderCell = function(filename, diff_index) {	
	var self = this;

	if (self._layoutModel.isDir(filename) && self._layoutModel.isOpen(filename)) {
		return;
	}

	let commit_width = self._commit_width;
	let x = commit_width * (diff_index - self._fromCommit);
	let fileTop = self.fileYTop(filename);
	let maxFileHeight = self.fileHeight(filename); // pixels
	let sha = self._revList[diff_index];
	let author = self._model.getCommitAuthor(sha);
	let linesAtCommit = self._model.fileSize(filename, self._revList[diff_index]);

	if (!self._authorColors.hasOwnProperty(author)) {
		let author_count = Object.keys(self._authorColors).length;
		self._authorColors[author] = AUTHOR_COLORS[author_count % AUTHOR_COLORS.length];
	}


	if (filename === self._highlightedFile) {
		self._context.fillStyle = self._isSelected
									? COLORS.REPO_SELECT
									: COLORS.REPO_HIGHLIGHT;
	} else {
		if (self._layoutModel.isDir(filename)) {
			self._context.fillStyle = COLORS.REPO_DIR
		} else {
			self._context.fillStyle = COLORS.REPO;
		}
	}

	let heightAtCommit = self.fileHeightAtCommit(filename, diff_index);
	let blame = self._model.getBlame(sha);

	self._context.beginPath();
	self._fillRect(x,
		fileTop,
		commit_width,
		heightAtCommit
	);

	//self._context.save();
	//self._context.clip();
	
	if (blame && blame[filename] && filename != self._highlightedFile) {
		blame[filename].forEach(function(chunk) {
			let fileLen = self._layoutModel.fileMaxSize(filename); // lines
			let linenum = chunk.from;
			let editLen = chunk.to - chunk.from;
			let dy =  fileLen < 0 
						? maxFileHeight
						: (editLen*maxFileHeight)/fileLen;
			let y = fileLen < 0
						? fileTop
						: fileTop + (linenum * maxFileHeight)/fileLen;
 
			self._context.fillStyle = 
				self._commitColor(diff_index-self._revIndex[chunk.commit],
								//COLORS.DIFF);
								self._authorColors[self._model.getCommitAuthor(chunk.commit)]);
			
			//ASSERT(y >= fileTop);
			//ASSERT(y + dy >= fileTop);
			//ASSERT(y <= fileTop + maxFileHeight);
			//ASSERT(y + dy <= fileTop + maxFileHeight);

			self._context.beginPath();
			self._fillRect(x,
				y,
				commit_width,
				dy
			);
		});
	}

	//self._context.restore();

	// diff
	let diff_summary = self._model.getDiffSummary(self._revList[diff_index]);
	self._context.fillStyle = self._layoutModel.isDir(filename) 
		? self._authorColors[author] //COLORS.DIFF_DIR
		: self._authorColors[author];
	if (self._highlightedFile == filename
		|| (self._highlightedCommitIndex == diff_index
		&& self._toCommit != self._fromCommit)) {
		self._context.fillStyle = COLORS.DIFF_HIGHLIGHT;
	}


	if (self._layoutModel.isDir(filename) && diff_summary) {
		let changed_files = Object.keys(diff_summary);
		let mark_commit = false;
		for (let i=0; i < changed_files.length; i++) {
			if (self.isDescendantOf(changed_files[i], filename)) {
				mark_commit = true;
				break;
			}
		}
		if (mark_commit) {
			self._fillRect(x,
					fileTop,
					commit_width,
					maxFileHeight
				);
		}
	} else {

		if (diff_summary && diff_summary.hasOwnProperty(filename)) {
			let edits = diff_summary[filename]; // [[169,-7], [169,7], ... ],
			let fileLen = self._layoutModel.fileMaxSize(filename); // lines
			
			let i, change, dy, y;
			for (i=0; i < edits.length; i++) {
				change = edits[i]; // [169,7]
				if (change[1] < 0)
					continue;
				dy =  fileLen < 0
							? maxFileHeight
							: (change[1]*maxFileHeight)/fileLen;
				y = fileLen < 0
							? fileTop
							: fileTop + (change[0] * maxFileHeight)/fileLen;

				self._fillRect(x,
					y,
					commit_width,
					dy
				);
			}
			
		}
	}
}


RepoView.prototype._fillRect = function(x, y, dx, dy) {
	var self = this;
	//if (dx < 1 || dy < 1)
	//	return;

	self._context.fillRect(x + self._x, y, dx, dy);
	rect_count++;
}

RepoView.prototype._commitColor = function(delta, blend_color) {
	var self = this;
	var factor = Math.exp(-.02*delta);

	if (blend_color.startsWith('#'))
		blend_color = hex2rgb(blend_color);
	var rgb = blend_color.replace(/[^\d,]/g, '').split(',');

	var r = Math.round(REPO_RGB.r + factor * (rgb[0] - REPO_RGB.r));
	var g = Math.round(REPO_RGB.g + factor * (rgb[1] - REPO_RGB.g));
	var b = Math.round(REPO_RGB.b + factor * (rgb[2] - REPO_RGB.b));
	return "rgb(" + r + "," + g + "," + b + ")";
}

function hex2rgb(hex){
	 hex = hex.replace('#','');
	 var r = parseInt(hex.substring(0, hex.length/3), 16);
	 var g = parseInt(hex.substring(hex.length/3, 2*hex.length/3), 16);
	 var b = parseInt(hex.substring(2*hex.length/3, 3*hex.length/3), 16);

	 return 'rgba('+r+','+g+','+b+')';
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}

Logger.channels[Logger.CHANNEL.REPO_VIEW] = Logger.LEVEL.INFO;
