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
/*
@history_data: [
	{
		commit: <sha>
		tree: {
			filename: length,
			...
		}
	},
	...
]

@diffs: [
	{
		commit: {
			id: <sha>,
			tree: <sha>,
			commit_msg: <string>
		},
		diffs: {
			filename: {
				summary: ["-119,6","+119,7"],
				raw: <diffstr>
			}
			...
		}
	},
...
]
*/
var CanvasRenderer = function(revCount) {
	console.log("CanvasRenderer()");
	var self = this;

	this._canvas = document.getElementById("repo_canvas");
	this._context = this._canvas.getContext('2d');

	this._width = this._canvas.width;
	this._height = this._canvas.height;
	
	
	this._filesCanvas = document.getElementById("filenames");
	this._filesContext = this._filesCanvas.getContext('2d');
	this._filesWidth = this._filesCanvas.width;

	this._lastMouseX = -1;
	this._lastMouseY = -1;
	this._pixelsPerLine = 1;

	this._revCount = revCount;

	this._selectedFile = "";
	this._filter = "";

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	$(this._canvas).dblclick(this.historyDoubleClick.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	//$("#filenames").dblclick(this.filesDoubleClick.bind(this));
	$("#filenames").click(this.filesClick.bind(this));
	//$("#filter_button").on('click', self.onFilterClick.bind(self));
	$("#next_button").on('click', self.onNextClick.bind(self));
	$("#back_button").on('click', self.onPrevClick.bind(self));


	this._downloader = new Downloader();	
	this._dirView = new DirectoryView("/", null);
	this._dirView.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);
};

CanvasRenderer.prototype.setData = function(revList, model, from, to) {
	var self = this;
	self._revList = revList;
	self._model = model;
	self._fromAbs = from;
	self._toAbs = to;

	self._dirView.setModel(model);

	self._fromCommit = 0;
	self._toCommit = self._revList.length-1;

	var files = self._dirView.getAll();

	if (files.length > 500) {
		// collapse all dirs
		files.forEach(function(filename) {
			if (self._model.isDir(filename)) {
				self._model.setOpen(filename, false);
			}
		});
	}

	self.calculateLayout();
	self.render();
};

CanvasRenderer.prototype.onFilterClick = function() {
	var self = this;

	self._filter = $("#filter_input").val();
	self.calculateLayout();
	self.render();
	
};

CanvasRenderer.prototype.onNextClick = function() {
	var self = this;

	var repo = urlParam("repo");

	if (self._toAbs < self._revCount) {
		var delta = self._toAbs - self._fromAbs;
		var from = self._fromAbs + Math.round(delta/3);
		var to = from + delta;
		to = Math.min(to, self._revCount);
		self._downloader.get("/rangeJSON?repo=" + repo + "&from="+from+"&to="+to,
			self.ajaxDone.bind(self));
	}
	
};

CanvasRenderer.prototype.onPrevClick = function() {
	var self = this;

	var repo = urlParam("repo");

	if (self._fromAbs > 0) {
		var delta = self._toAbs - self._fromAbs;
		var from = self._fromAbs - Math.round(delta/3);
		from = Math.max(from, 0);
		var to = from + delta;
		self._downloader.get("/rangeJSON?repo=" + repo + "&from="+from+"&to="+to,
			self.ajaxDone.bind(self));
	}
	
};

CanvasRenderer.prototype.ajaxDone = function(success, data) {
	var self = this;
	if (success) {
		var revList = data.commits.map(function(commit) {
			return commit.hash;
		});
		var model = new RepoModel();
		model.setRangeData(data.commits, data.size_history, data.diff_summaries);
		self.setData(revList,
			model, 
			parseInt(data.fromRev), 
			parseInt(data.toRev)
		);
	}
};

CanvasRenderer.prototype.calculateLayout = function() {
	console.log("calculateLayout()");
	var self = this;

	self._dirView.layout();
	self._files = self._dirView.displayOrder(); // sorted in display order, top-to-bottom
};


CanvasRenderer.prototype.isDir = function(filename) {
	return filename.endsWith('/');
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
	var self = this;

	self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.strokeStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.clearRect(0, 0, self._filesWidth, self._height);
	self._filesContext.fillRect(0, 0, self._filesWidth, self._height);

	self._dirView.renderDirectories(self._filesContext);	
};

CanvasRenderer.prototype.highlightFilenames = function() {
	return;
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
		var font = self._model.isDir(filename) ? FONT_DIR : FONT_LARGE;
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

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);

	self._files.forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			self.renderFileHistory(filename);
			self.renderFileDiffs(filename);
		}
	});
};

// in pixels
CanvasRenderer.prototype.fileYTop = function(filename) {
	var self = this;
	return self._dirView.getFileY(filename);
};

// in pixels
CanvasRenderer.prototype.fileYBottom = function(filename) {
	var self = this;
	return self.fileYTop(filename) + self.fileHeight(filename);
};

// in pixels
CanvasRenderer.prototype.fileHeight = function(filename) {
	var self = this;
	return self._dirView.getFileDY(filename);
};

// in pixels
// @commit_index = index into self._history
CanvasRenderer.prototype.fileHeightAtCommit = function(filename, commit_index) {
	var self = this;
	if (self._model.isDir(filename)) {
		return FONT_DIR.height;
	} else {
		return  self._model.fileSize(filename, self._revList[commit_index]) 
		 	* self.fileHeight(filename) / self._model.fileMaxSize(filename);
	}
};

// in pixels
CanvasRenderer.prototype.fileYMiddle = function(filename) {
	var self = this;
	return (self.fileYBottom(filename) + self.fileYTop(filename))/2;
};

CanvasRenderer.prototype.renderFileHistory = function(filename) {
	var self = this;
	if (!self.isDrawn(filename)) {
		return;
	}
	//console.log("renderFileHistory", filename);
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


CanvasRenderer.prototype.renderFileDiffs = function(filename) {
	var self = this;
	if (!self.isDrawn(filename)) {
		return;
	}
	for (var index = self._fromCommit; index <= self._toCommit; index++) {
		self.renderFileDiff(index, filename);
	};
};

CanvasRenderer.prototype.renderDiff = function(diff_index) { 
	var self = this;
	if (!diff_index < 0 || !diff_index >= self._revList.length) 
		return;

	var diff_summary = self._model.getDiffSummary(self._revList[diff_index]);
	if (diff_summary) {
		var files = {};
		self._files.forEach(function(file) {
			files[file] = true;
		});

		Object.keys(diff_summary).forEach(function(filename) {
			if (files.hasOwnProperty(filename))
				self.renderFileDiff(diff_index, filename);
		});
	}
};

// diff:  // {commit:{}, diffs: {"public/css/main.css":["-1,5","+1,9"],"public/js/renderer.js":["-5,21","+5,27","-29,13","+35,36"]}
CanvasRenderer.prototype.renderFileDiff = function(diff_index, filename) { 
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
		//self.renderDiffContent();
	}

	var fileTop = self.fileYTop(filename);
	var fileHeight = self.fileHeight(filename);
	var x = commit_width * diff_index;

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

		if (diff_summary.hasOwnProperty(filename)) {
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

CanvasRenderer.prototype.renderDiffContent = function() {
	/*
	let self = this;
	$("#code_textarea").text("");
	if (self._selectedCommitIndex >= 0 
		&& self._selectedCommitIndex < self._revList.length) {
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
	*/
};

CanvasRenderer.prototype.historyDoubleClick = function(event) {
	var self = this;
	// show commit
	var index = self.commitIndexFromXCoord(event.offsetX);
	self._selectedCommitIndex = -1;
	var text = "[" + self._model.getCommitDate(self._revList[index]) + "]: ";
	text += self._model.getCommitMsg(self._revList[index]);
	$("#commit_info").text(text);
	self._fromCommit = index;
	self._toCommit = index;
	self._files = self._files.filter(function(filename) {
		return self._model.fileSize(filename, self._revList[index]) > 0;
	});
	self.calculateLayout();
	self.render();
};

CanvasRenderer.prototype.filesDoubleClick = function(event) {
	var self = this;
	// show file history
	if (self._selectedFile) {
		self._fromCommit = 0;
		self._toCommit = self._revList.length-1;
		$("#filter_input").val(self._selectedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._dirView.handleFilesClick(event)) {
		self.calculateLayout();
		self.render();
	}
};


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
			if (index >= 0 && index < self._revList.length) {
				msg = "[" + self._model.getCommitDate(self._revList[index]) + "]: ";
				msg += self._model.getCommitMsg(self._revList[self._selectedCommitIndex]);
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
		//console.log("Selected:", file);

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
	if (index >= 0 && index < self._revList.length) {
		return self._fromCommit+index;
	}
	return -1;
}

CanvasRenderer.prototype.isDrawn = function(filename) {
	var self = this;
	if (!self._model.isVisible(filename)) {
		return false;
	}
	if (self._model.isDir(filename) && self._model.isOpen(filename)) {
		return false;
	}
	return true;
}


var urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return results[1] || 0;
    }
}

