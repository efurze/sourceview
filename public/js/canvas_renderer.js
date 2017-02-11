'use strict'

var COLORS = {
 FILES_BACKGROUND: 	'#F0DAA4', 	// goldenrod
 REPO_BACKGROUND: 	'#A2BCCD', 	// light blue
 REPO: 				'#8296A4', 	// medium blue
 DIFF: 				'#424D54',	// blue-black
 DIFF_HIGHLIGHT: 	'#FFFFD5',	// light yellow 

 REPO_DIR: 			'#AD3232', 	// 
 DIFF_DIR: 			'#561919',	// 
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

var CanvasRenderer = function(range_data, history_data, diffs) {
	console.log("CanvasRenderer()");
	var self = this;
	this._range = range_data; // {'filename': size, }
	this._history = history_data; // indexed by commit
	this._diffs = diffs;		

	this._canvas = document.getElementById("repo_canvas");
	this._context = this._canvas.getContext('2d');

	this._width = this._canvas.width;
	this._height = this._canvas.height;
	
	
	this._filesCanvas = document.getElementById("filenames");
	this._filesContext = this._filesCanvas.getContext('2d');
	this._filesWidth = this._filesCanvas.width;

	this._lastMouseX = -1;
	this._lastMouseY = -1;
	this._yAxis = {}; // filename => y-coord in pixels of top of file
	this._pixelsPerLine = 1;

	this._fromCommit = 0;
	this._toCommit = diffs.length-1;
	this._files = Object.keys(range_data); // sorted in display order, top-to-bottom
	this._selectedFile = "";
	this._filter = "";
	this._closedDirs = {};

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	$(this._canvas).dblclick(this.historyDoubleClick.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	$("#filenames").dblclick(this.filesDoubleClick.bind(this));
	$("#filenames").click(this.filesClick.bind(this));
	$("#filter_button").on('click', self.onFilterClick.bind(self));


	// collapse all dirs
	self._files.forEach(function(filename) {
		self.closeFile(filename);
	});


	console.log("calculateLayout");
	this.calculateLayout();
	this.render();
};

CanvasRenderer.prototype.onFilterClick = function() {
	var self = this;
	//$("#filenames").css("transform", "scale(0.5)");

	//$("#canvas_div").removeClass("col-md-10");
	//$("#canvas_div").addClass("col-md-6");


	
	self._filter = $("#filter_input").val();
	self.calculateLayout();
	self.render();
	
};

CanvasRenderer.prototype.calculateLayout = function() {
	console.log("calculateLayout()");
	var self = this;

	self._files = Object.keys(self._range)
					.filter(function(filename) {
						if (!self._filter || self._filter === "") {
							return true;
						}
						return filename.startsWith(self._filter);
					});

	// filter out descendants of closed dirs
	var closedDirsHash = {};
	self._files = self._files.filter(function(file) {
		if (!self.isVisible(file)) {
			var visibleDir = self.visibleAncestor(file);
			if (!closedDirsHash.hasOwnProperty(visibleDir)) {
				closedDirsHash[visibleDir] = true;
			}
			return false;
		}
		return true;
	});

	// add in the directories
	var closedDirs = Object.keys(closedDirsHash);
	closedDirs.forEach(function(dir) {
		self._files.push(dir);
	});

	// sort
	self._files.sort(function (a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	var visibleLines = 0;

	self._files.forEach(function(file) {
		if (self.isVisible(file) && !self.isDir(file)) {
			visibleLines += self._range[file];
		}
	});

	var pixelsPerDir = FONT_DIR.height;
	self._pixelsPerLine = (self._height - closedDirs.length * pixelsPerDir)/visibleLines;

	var yCoord = 0;
	self._yAxis = {};
	self._files.forEach(function(file) {
		self._yAxis[file] = yCoord;
		if (self.isDir(file)) {
			yCoord += pixelsPerDir;
			//self._range[file] = pixelsPerDir;
		} else {
			yCoord += self._range[file] * self._pixelsPerLine;
		}
	});
};


CanvasRenderer.prototype.isDir = function(filename) {
	return filename.endsWith('/');
}

CanvasRenderer.prototype.isVisible = function(filename) {
	var self = this;
	var parts = filename.split('/');
	var dirname = "";
	for (var i=0; i < parts.length; i++) {
		dirname += parts[i] + '/';
		if (self._closedDirs.hasOwnProperty(dirname)) {
			return false;
		}
	}
	return true;
}

CanvasRenderer.prototype.visibleAncestor = function(filename) {
	var self = this;
	var parts = filename.split('/');
	var dirname = "";
	for (var i=0; i < parts.length; i++) {
		dirname += parts[i] + '/';
		if (self._closedDirs.hasOwnProperty(dirname)) {
			return dirname;
		}
	}
	return "";
}

CanvasRenderer.prototype.isDescendantOf = function(filename, dir) {
	var self = this;
	return filename.startsWith(dir);
}

CanvasRenderer.prototype.render = function() {
	var self = this;
	self.renderFilenames();
	self.renderHistory();
};

CanvasRenderer.prototype.renderFilenames = function() {
	console.log("renderFilenames");
	var self = this;
	self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.strokeStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.clearRect(0, 0, self._filesWidth, self._height);
	self._filesContext.fillRect(0, 0, self._filesWidth, self._height);


	var y = self._height + FONT_NORMAL.height;
	var filecount = self._files.length;

	// Draw bottom-to-top so we elide the small files instead of the big ones
	for (var i=1; i <= filecount; i++) {
		var filename = self._files[filecount - i];
		var font = self.isDir(filename) ? FONT_DIR : FONT_NORMAL;
		var nextShouldBeAt = self.fileYMiddle(filename) + font.height/2;
		if (nextShouldBeAt <= y - font.height || self.isDir(filename)) {
			y = nextShouldBeAt;

			if (self.isDir(filename)) {
				self._filesContext.beginPath();
				self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
				self._filesContext.fillRect(0, y, self._filesWidth, font.height + 4);
			}

			self._filesContext.strokeStyle = font.color;
			self._filesContext.fillStyle = font.color;
			self._filesContext.font = font.name;
			self._filesContext.fillText(filename, 5, y);
		}
	}		
};

CanvasRenderer.prototype.highlightFilenames = function() {
	var self = this;
	var fontHeight;
/*
	// files in this diff
	if (self._selectedCommitIndex >= 0 && self._fromCommit != self._toCommit) {
		var diff = self._diffs[self._selectedCommitIndex];
		Object.keys(diff.diffs).forEach(function(filename) {
			fontHeight = FONT_NORMAL.height;
			var y = self.fileYMiddle(filename) - fontHeight/2 - 2;

			self._filesContext.beginPath();
			self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
			self._filesContext.fillRect(0, y, self._filesWidth, fontHeight + 4);

			self._filesContext.beginPath();
			self._filesContext.fillStyle = 'red';
			self._filesContext.font = FONT_NORMAL.height;
			self._filesContext.fillText(filename, 10, y);
		});
	}
*/
	var filename = self._selectedFile;
	if (filename) {
		var font = self.isDir(filename) ? FONT_DIR : FONT_LARGE;
		var y = self.fileYMiddle(filename) - font.height/2 - 4;
		self._filesContext.beginPath();
		self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
		self._filesContext.strokeStyle = font.color;
		self._filesContext.fillRect(0, y, self._filesWidth, font.height + 8);
		self._filesContext.rect(0, y, self._filesWidth, font.height + 8);
		self._filesContext.stroke();

		self._filesContext.fillStyle = font.color;
		self._filesContext.font = font.name;
		self._filesContext.fillText(filename, 5, self.fileYMiddle(filename) + font.height/2);
	}
}

CanvasRenderer.prototype.renderHistory = function() {
	console.log("renderHistory");
	var self = this;

	self._files.forEach(function(filename) {
		self.renderFileHistory(filename);
		self.renderFileDiffs(filename);
	});
};

// in pixels
CanvasRenderer.prototype.fileYTop = function(filename) {
	var self = this;
	return self._yAxis[filename];
};

// in pixels
CanvasRenderer.prototype.fileYBottom = function(filename) {
	var self = this;
	return self.fileYTop(filename) + self.fileHeight(filename);
};

// in pixels
CanvasRenderer.prototype.fileHeight = function(filename) {
	var self = this;
	if (self.isDir(filename)) {
		return FONT_DIR.height;
	} else {
		return (self._range[filename] * self._pixelsPerLine);
	}
};

// in pixels
// @commit_index = index into self._history
CanvasRenderer.prototype.fileHeightAtCommit = function(filename, commit_index) {
	var self = this;
	if (self.isDir(filename)) {
		return FONT_DIR.height;
	} else {
		if (self._history[commit_index].tree.hasOwnProperty(filename)) {
			return (self._history[commit_index].tree[filename] * self._pixelsPerLine);
		} else {
			return 0;
		}
	}
};

// in pixels
CanvasRenderer.prototype.fileYMiddle = function(filename) {
	var self = this;
	return (self.fileYBottom(filename) + self.fileYTop(filename))/2;
};

CanvasRenderer.prototype.renderFileHistory = function(filename) {
	var self = this;

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);	
	var x = self._width - commit_width;
	var fileTop = self.fileYTop(filename);
	var maxFileHeight = self.fileHeight(filename);

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.fillRect(0, fileTop, self._width, maxFileHeight);

	for (var index=self._fromCommit; index <= self._toCommit; index++) {
		var dy = self.fileHeightAtCommit(filename, index);
		if (filename === self._selectedFile) {
			self._context.fillStyle = "grey";
		} else {
			self._context.fillStyle = self.isDir(filename) 
				? COLORS.REPO_DIR
				: COLORS.REPO;
		}
		self._context.fillRect(x,
			fileTop,
			commit_width,
			dy
		);
		x -= commit_width;
	};

};


CanvasRenderer.prototype.renderFileDiffs = function(filename) {
	var self = this;

	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self.renderFileDiff(index, filename);
	};
};

CanvasRenderer.prototype.renderDiff = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];
	if (diff) {
		var files = {};
		self._files.forEach(function(file) {
			files[file] = true;
		});

		Object.keys(diff.diffs).forEach(function(filename) {
			if (files.hasOwnProperty(filename))
				self.renderFileDiff(diff_index, filename);
		});
	}
};

// diff:  // {commit:{}, diffs: {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
CanvasRenderer.prototype.renderFileDiff = function(diff_index, filename) { 
	var self = this;
	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);

	if (!diff_index < 0 || !diff_index >= self._diffs.length) 
		return;

	var diff = self._diffs[diff_index];

	self._context.fillStyle = self.isDir(filename) 
		? COLORS.DIFF_DIR
		: COLORS.DIFF;
	if (self._selectedCommitIndex == diff_index
		&& self._toCommit != self._fromCommit) {
		self._context.fillStyle = COLORS.DIFF_HIGHLIGHT;
		//self.renderDiffContent();
	}

	var fileTop = self.fileYTop(filename);
	var fileHeight = self.fileHeight(filename);
	var x = commit_width * (self._toCommit - diff_index);

	if (self.isDir(filename)) {
		var changed_files = Object.keys(diff.diffs);
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
		var fileLen = self._range[filename];

		if (diff.diffs.hasOwnProperty(filename)) {
			var edits = diff.diffs[filename].summary;

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

CanvasRenderer.prototype.renderDiffContent = function() {
	let self = this;
	$("#code_textarea").text("");
	if (self._selectedCommitIndex >= 0 
		&& self._selectedCommitIndex < self._diffs.length) {
		let diff_info = self._diffs[self._selectedCommitIndex];
		if (diff_info && self._selectedFile) {
			let diff = diff_info.diffs;

			if (diff.hasOwnProperty(self._selectedFile)
				&& diff[self._selectedFile].raw) {
				let diff_str = decodeURI(diff[self._selectedFile].raw);
				//$("#code_textarea").text(diff_str);

				var diff2htmlUi = new Diff2HtmlUI({
					diff: diff_str
				});
				diff2htmlUi.draw('#code_div', {inputFormat: 'diff', showFiles: false, matching: 'lines'});
			}
		}
	}
};

CanvasRenderer.prototype.historyDoubleClick = function(event) {
	var self = this;
	// show commit
	var index = self.commitIndexFromXCoord(event.offsetX);
	self._selectedCommitIndex = -1;
	$("#commit_info").text(self._diffs[index].commit.commit_msg);
	self._fromCommit = index;
	self._toCommit = index;
	self._files = self._files.filter(function(filename) {
		return self._diffs[index].diffs.hasOwnProperty(filename);
	});
	self.calculateLayout();
	self.render();
};

CanvasRenderer.prototype.filesDoubleClick = function(event) {
	var self = this;
	// show file history
	if (self._selectedFile) {
		self._fromCommit = 0;
		self._toCommit = self._diffs.length-1;
		$("#filter_input").val(self._selectedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._selectedFile) {
		if (self.isDir(self._selectedFile)
			&& self._closedDirs.hasOwnProperty(self._selectedFile)) {
			delete self._closedDirs[self._selectedFile];
		} else {
			self.closeFile(self._selectedFile);
		}
		self.calculateLayout();
		self.render();
	}

};

CanvasRenderer.prototype.closeFile = function(filename) {
	var self = this;
	if (!self.isDir(filename)) {
		var parts = filename.split('/');
		parts.pop();
		var dir = parts.join('/') + '/';
		self._closedDirs[dir] = true;
	}
}

CanvasRenderer.prototype.mouseMoveHistoryWindow = function(event) {
	var self = this;
	if (event.offsetX == self._lastMouseX 
		&& event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseX != event.offsetX) {
		self._lastMouseX = event.offsetX;
		var index = self.commitIndexFromXCoord(event.offsetX);
		if (index != self._selectedCommitIndex) {
			var previous = self._selectedCommitIndex;
			var msg = "";
			self._selectedCommitIndex = index;
			if (index >= 0 && index < self._diffs.length) {
				msg = self._diffs[self._selectedCommitIndex].commit.commit_msg;
			}
			$("#commit_info").text(msg);
			
			if (previous >= 0) {
				self.renderDiff(previous);
			}
			self.renderDiff(index);
			self.renderFilenames();
			self.highlightFilenames();
		}
	}

	if (self._lastMouseY != event.offsetY) {
		self.handleMouseYChange(event);
	}
};

CanvasRenderer.prototype.mouseMoveFilesWindow = function(event) {
	var self = this;
	if (event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseY != event.offsetY) {
		self.handleMouseYChange(event);
	}
};

CanvasRenderer.prototype.handleMouseYChange = function(event) {
	var self = this;
	self._lastMouseY = event.offsetY;
	var file = self.fileFromYCoord(event.offsetY);
	if (file != self._selectedFile) {
		var previous = self._selectedFile;
		self._selectedFile = file;

		if (previous) {
			self.renderFileHistory(previous);
			self.renderFileDiffs(previous);
		}
		self.renderFileHistory(file);
		self.renderFileDiffs(file);
		self.renderFilenames();
		self.highlightFilenames();
		self.renderDiffContent();
	}
};


CanvasRenderer.prototype.fileFromYCoord = function(y) {
	var self = this;
	var index = 0;
	var offset = 0;
	var next_index = self._files.length - 1;
	var next_offset = self._height;

	while (next_index - index > 1) {
		var bisect_index = Math.round((next_index+index)/2);
		var bisect_offset = self.fileYTop(self._files[bisect_index]);

		if (y <= bisect_offset) {
			next_index = bisect_index;
			next_offset = bisect_offset;
		} else {
			index = bisect_index;
			offset = bisect_offset;
		}
	}
	return self._files[index];
}

CanvasRenderer.prototype.commitIndexFromXCoord = function(x) {
	var self = this;
	var length = self._toCommit - self._fromCommit + 1;
	var index = Math.floor((length * x) / self._width);
	if (index >= 0 && index < self._diffs.length) {
		return self._toCommit-index;
	}
	return -1;
}



