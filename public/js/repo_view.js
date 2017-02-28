'use strict'

var COLORS = {
 FILES_BACKGROUND: 	'#F0DAA4', 	// goldenrod
 REPO_BACKGROUND: 	'#A2BCCD', 	// light blue
 REPO: 				'rgb(130,150,164)', // medium blue
 DIFF: 				'rgb(66, 77, 84)',	// blue-black
 DIFF_HIGHLIGHT: 	'#FFFFD5',	// light yellow 

 REPO_DIR: 			'#686a83', 	// 
 DIFF_DIR: 			'#414252',	// 
};

var REPO_RGB = {
	r: 130,
	g: 150,
	b: 164
};

var DIFF_RGB = {
	r: 66,
	g: 77,
	b: 84
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

var AUTHOR_COLORS = [
	'rgb(200,0,0)',
	'rgb(0,0,200)',
	'rgb(0,200,0)',
	'rgb(200,200,0)',
	'rgb(255,165,0)'
];

var rect_count = 0;

var RepoView = function(context, model, layout, revList) {
	var self = this;
	this._context = context;
	this._revList = revList;
	this._width = 0;
	this._height = 0;
	this._selectedFile = "";
	this._selectedCommitIndex = -1;
	this._dirtyFiles = {};
	this._dirtyFilesAry = [];
	this._dirtyCommits = {};
	this._dirtyCommitsAry = [];
	this._revIndex = {};
	this._authorColors = {};
	this._layoutObj = layout;
	this._model = model;
	this._layout = {};

	layout.addListener(this.layoutChanged.bind(this));

	revList.forEach(function(sha, index) {
		self._revIndex[sha] = index;
	});
}

RepoView.prototype.setClip = function(x, y, dx, dy) {
	this._x = x;
	this._y = y;
	this._width = dx;
	this._height = dy;
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
	var self = this;
	for(var i=self._fromCommit; i<=self._toCommit; i++) {
		self.markCommit(self._revList[i]);
	}
}

RepoView.prototype.layoutChanged = function() {
	var self = this;
	self._layout = self._layoutObj.getLayout();
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
			self.markCommit(self._revList[previous]);
		}
		self.markCommit(self._revList[index]);
		self.render();
	}
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

	self._fromCommit = from;
	self._toCommit = to;
	self._commit_width = self._width/(self._toCommit - self._fromCommit + 1);	
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
		return self.fileHeight(filename);
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
	if (self._dirtyCommitsAry.length)
		requestAnimationFrame(self._renderCommits.bind(self));
	else if (self._dirtyFilesAry.length)
		requestAnimationFrame(self._renderFiles.bind(self));
}

RepoView.prototype._renderFiles = function() {
	var self = this;
	var counter = 0;
	rect_count = 0;
	//console.time("repo render");

	while (counter++ < 2 && self._dirtyFilesAry.length) {
		var filename = self._dirtyFilesAry.shift();
		delete self._dirtyFiles[filename];
		if (self._model.isVisible(filename)) {
			self._renderFile(filename);
		}
	}

	//console.log(rect_count);
	//console.timeEnd("repo render");

	self.render();
}

RepoView.prototype._renderCommits = function() {
	var self = this;
	var counter = 0;
	rect_count = 0;
	//console.time("repo render");

	while (counter++ < 2 && self._dirtyCommitsAry.length) {
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

	//console.log("Drawing commit", diff_index, self._revList[diff_index],
	//	"at column", diff_index - self._fromCommit);
	
	Object.keys(self._layout).forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self._renderCell(filename, diff_index);
		}
	})
};

// draw a row
RepoView.prototype._renderFile = function(filename) {	
	var self = this;
	if (!self._layout.hasOwnProperty(filename)) {
		return;
	}
	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self._renderCell(filename, index);
	};
}


RepoView.prototype._renderCell = function(filename, diff_index) {	
	var self = this;

	if (self._model.isDir(filename) && self._model.isOpen(filename)) {
		return;
	}

	var commit_width = self._commit_width;
	var x = commit_width * (diff_index - self._fromCommit);
	var fileTop = self.fileYTop(filename);
	var maxFileHeight = self.fileHeight(filename); // pixels
	var sha = self._revList[diff_index];
	var author = self._model.getCommitAuthor(sha);
	var linesAtCommit = self._model.fileSize(filename, self._revList[diff_index]);

	if (!self._authorColors.hasOwnProperty(author)) {
		var author_count = Object.keys(self._authorColors).length;
		self._authorColors[author] = AUTHOR_COLORS[author_count % AUTHOR_COLORS.length];
	}

	// size
	self._context.beginPath();
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._fillRect(x,
		fileTop,
		commit_width,
		maxFileHeight
	);

	if (filename === self._selectedFile) {
		self._context.fillStyle = "grey";
	} else {
		if (self._model.isDir(filename)) {
			self._context.fillStyle = COLORS.REPO_DIR
		} else {
			self._context.fillStyle = COLORS.REPO;
		}
	}

	var fileLen = self._model.fileMaxSize(filename); // lines
	var heightAtCommit = self.fileHeightAtCommit(filename, diff_index);
	var blame = self._model.getBlame(sha);

	self._context.beginPath();
	self._fillRect(x,
		fileTop,
		commit_width,
		heightAtCommit
	);

	self._context.save();

	self._context.rect(x,
		fileTop,
		commit_width,
		heightAtCommit
	);
	self._context.clip();
	
	if (blame && blame[filename] && filename != self._selectedFile) {
		blame[filename].forEach(function(chunk) {
			var linenum = chunk.from;
			var editLen = chunk.to - chunk.from;
			var dy =  (editLen*maxFileHeight)/fileLen;
			var y = fileTop + (linenum * maxFileHeight)/fileLen;
 
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

	self._context.restore();

	// diff
	var diff_summary = self._model.getDiffSummary(self._revList[diff_index]);
	self._context.fillStyle = self._model.isDir(filename) 
		? COLORS.DIFF_DIR
		: self._authorColors[author];
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
			self._fillRect(x,
					fileTop,
					commit_width,
					maxFileHeight
				);
		}
	} else {

		if (diff_summary && diff_summary.hasOwnProperty(filename)) {
			var edits = diff_summary[filename];

			edits.forEach(function(edit) { // "+1,9"
				var parts = edit.split(",");
				var linenum = parseInt(parts[0].slice(1));
				var editLen = parseInt(parts[1]);
				var dy =  (editLen*maxFileHeight)/fileLen;
				var y = fileTop + (linenum * maxFileHeight)/fileLen;

				self._fillRect(x,
					y,
					commit_width,
					dy
				);
			});
		}
	}
}


RepoView.prototype._fillRect = function(x, y, dx, dy) {
	var self = this;
	//if (dx < 1 || dy < 1)
	//	return;

	self._context.fillRect(x, y, dx, dy);
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


