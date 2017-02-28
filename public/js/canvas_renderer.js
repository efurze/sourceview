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
var CanvasRenderer = function(revList) {
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

	this._revCount = revList.length;
	this._revList = revList;

	this._selectedFile = "";
	this._filter = "";
	this._mouseDown = false;
	this._mouseDownPos = {
		x: -1,
		y: -1
	};
	this._xForLastCanvasShift = 0;
	this._isScrolling = false;
	this._selectionFrozen = false;
	this._model = new RepoModel();

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	$(this._canvas).mousedown(this.mouseDown.bind(this));
	$(this._canvas).click(this.repoClick.bind(this));
	$(document).mouseup(this.mouseUp.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	//$("#filenames").dblclick(this.filesDoubleClick.bind(this));
	$("#filenames").click(this.filesClick.bind(this));
	//$("#filter_button").on('click', self.onFilterClick.bind(self));
	$("#next_button").on('click', self.onNextClick.bind(self));
	$("#back_button").on('click', self.onPrevClick.bind(self));


	this._downloader = new Downloader();

	this._layout = new Layout(this._model);
	this._layout.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._dirView = new DirectoryView(this._layout, this._filesContext, this._model);
	this._dirView.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._repoView = new RepoView(this._context, revList);
	this._repoView.setClip(0, 0, this._canvas.width, this._canvas.height);
};

CanvasRenderer.prototype.setData = function(commits, initial_size, summaries, from, to) {
	var self = this;
	self._fromCommit = from;
	self._toCommit = to;
	self._repoView.setData(self._model, self._fromCommit, self._toCommit);
	self.render();
	setTimeout(self._updateData.bind(self, commits, initial_size, summaries, from, to),
		1);
}

CanvasRenderer.prototype._updateData = function(commits, initial_size, summaries, from, to) {
	var self = this;
	ASSERT(!isNaN(from));
	ASSERT(!isNaN(to));
	ASSERT(from < to);

	// construct history
	var history = {};
	history[commits[0].id] = initial_size[commits[0].id];
	for (var i=1; i<commits.length; i++) {
		var sha = self._revList[from+i];
		history[sha] = self._updateSizes(history[self._revList[from+i-1]],
										summaries[sha]);
	}

	var blame = {}; // sha: {filename : [{from: to: commit:}]}	
	self._model.addData(commits, history, summaries, blame);

	self._filterEmptyFiles();

	var files = Object.keys(history[self._revList[self._toCommit]]);
	if (files.length > 500) {
		// collapse all dirs
		self._layout.closeAll();
	}
	
	self.calculateLayout();
	self.render();


	blame = {};
	var counter = 1;
	var doBlame = function() {
		var sha = self._revList[from+counter];
		blame = self._updateBlame(blame,
									summaries[sha],
									commits[counter],
									history);
		var blame_hash = {};
		blame_hash[sha] = blame;
		self._model.addData([], {}, {}, blame_hash);
		self._repoView.markCommit(sha);
		self._repoView.render();
		counter ++;
		if (counter < commits.length) {
			setTimeout(doBlame, 1);
		}
	};
	//setTimeout(doBlame, 1);

};


CanvasRenderer.prototype.calculateLayout = function() {
	console.log("calculateLayout()");
	var self = this;

	self._layout.layout();
	self._files = self._layout.displayOrder();

	self._repoView.setYLayout(self._layout);
};


CanvasRenderer.prototype._filterEmptyFiles = function() {
	var self = this;

	var nonzeroFiles = {};
	var all_files = self._model.getFilenames();
	all_files.forEach(function(filename) {
		for (var i=self._fromCommit; i <= self._toCommit; i++) {
			var sha = self._revList[i];
			if (self._model.fileSize(filename, sha) > 0) {
				nonzeroFiles[filename] = true;
				return;
			}
		}
	});
}

/*
	@blame = {
			filename : [ // sorted by start line
			{
				from: 
				to: 
				author:
			}
		]
	}
*/
CanvasRenderer.prototype._updateBlame = function(blame, diff, commit, size_history) {
	var self = this;

	ASSERT(blame);
	ASSERT(commit);

	var updated = JSON.parse(JSON.stringify(blame));

	Object.keys(diff).forEach(function(filename) {

		updated[filename] = arrayify(updated[filename], 
							size_history[commit.id][filename]);

		var edits = diff[filename]
		edits.forEach(function(edit) { // "-1,8 +1,9"
			var parts = edit.split(' ');
			parts.forEach(function(part) {
				insertEdit(updated[filename], part, commit.id);
			});
		});

		updated[filename] = chunkify(updated[filename]);
	});

	return updated;
}

/* 
chunks = [{
	from:
	to:
	commit:
}...]
*/
function arrayify(chunks, filelength) {
	var ary = new Array(filelength);
	ary.fill(null);
	if (chunks) {
		chunks.forEach(function(chunk) {
			for (var i=chunk.from; i <= chunk.to; i++) {
				ary[i] = chunk.commit;
			}
		});
	}
	return ary;
}

function chunkify(ary) {
	var chunks = [];
	var chunk;
	var current_commit = "";
	for (var i=0; i < ary.length; i++) {
		if (!ary[i])
			continue;

		if (ary[i] != current_commit) {
			current_commit = ary[i];
			if (chunk) {
				chunk.to = i-1;
				chunks.push(chunk)
			}
			chunk = {
				from: i,
				commit: ary[i]
			}
		} 
	}
	if (chunk) {
		chunk.to = i-1;
		chunks.push(chunk);
	}
	return chunks;
}

/*
	edit: +1,9
*/
function insertEdit(ary, edit, commit_id) {
	var parts = edit.split(",");
	var sign = parts[0].charAt(0);
	var linenum = parseInt(parts[0].slice(1)) - 1;
	var editLen = parseInt(parts[1]);
	if (sign === "+") {
		for (var i=0; i<editLen; i++) {
			if (!ary[i+linenum]) {
				ary[i+linenum] = commit_id;
			} else {
				ary.splice(i+linenum, 0, commit_id);
			}
		}
	} else {
		ary.splice(linenum, editLen);
	}
}


CanvasRenderer.prototype._updateSizes = function(sizes, diff) {
	var self = this;
	var updated = JSON.parse(JSON.stringify(sizes));

	Object.keys(diff).forEach(function(filename) {
		var delta = 0;
		diff[filename].forEach(function(chunk) {
			// @@ -33,6 +35,12 @@
			// @@ -0,0 +1 @@
			if (!chunk.length) 
				return;
			let parts = chunk.split(" ");

			parts.forEach(function(chunk) {
				if (!chunk.length)
					return;
				let parts = chunk.split(",");
				let sign = parts[0].slice(0, 1);
				let count = 0;
				if (parts.length > 1) {
					count = parseInt(parts[1]);
				} else if (parts.length == 1){
					count = 1;
				}
				if (sign === "+") {
					delta += count;
				} else {
					delta -= count;
				}
			});
			if (!updated.hasOwnProperty(filename)) {
				updated[filename] = 0;
			}
		});
		updated[filename] += delta;
	});
	return updated;
}

CanvasRenderer.prototype.onFilterClick = function() {
	var self = this;

	self._filter = $("#filter_input").val();
	self.calculateLayout();
	self.render();
	
};

/*
	@count: # of commits to scroll. < 0 means right (prev)
*/
CanvasRenderer.prototype._scrollCanvas = function(count) {
	var self = this;

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);
	var visible_commits = self._toCommit - self._fromCommit;
	var previous_to = self._toCommit;
	var previous_from = self._fromCommit;
	if (count > 0) {
		self._toCommit = Math.min(self._revList.length-1, self._toCommit + count);
		self._fromCommit = self._toCommit - visible_commits;
	} else {
		self._fromCommit = Math.max(0, self._fromCommit + count);
		self._toCommit = self._fromCommit + visible_commits;
	}

	if (self._toCommit == previous_to)
		return;
		
	self._repoView.setCommitRange(self._fromCommit, self._toCommit)
	var img = self._context.getImageData(0,0,self._width, self._height);
	
	// clear canvas
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);

	self._context.putImageData(img, -(count*commit_width), 0);
}

CanvasRenderer.prototype.onNextClick = function() {
	var self = this;

	if (self._toCommit >= self._revCount-1)
		return;
	
	self._scrollCanvas(1);

	var repo = urlParam("repo");

	if (!self._model.hasCommit(self._revList[self._toCommit]))
	{
		var to = Math.min(self._revCount, self._toCommit + 10);
		var from = to - 10;
		ASSERT(!isNaN(from));
		ASSERT(!isNaN(to));
		self._downloader.get("/rangeJSON?repo=" + repo + "&from="+from+"&to="+to,
			self.ajaxDone.bind(self));
	} else {
		self._repoView.render();
	}
	
};

CanvasRenderer.prototype.onPrevClick = function() {
	var self = this;

	if (self._fromCommit <= 0)
		return;

	self._scrollCanvas(-1);

	var repo = urlParam("repo");
	if (!self._model.hasCommit(self._revList[self._fromCommit]))
	{
		var from = Math.max(self._fromCommit - 10, 0);
		var to = from + 10;
		self._downloader.get("/rangeJSON?repo=" + repo + "&from="+from+"&to="+to,
			self.ajaxDone.bind(self));
	} else {
		self._repoView.render();
	}
};

CanvasRenderer.prototype.ajaxDone = function(success, data) {
	var self = this;
	if (success) {
		self._updateData(data.commits, data.size_history, data.diff_summaries,
			parseInt(data.fromRev), parseInt(data.toRev));
	}
};


// in pixels
CanvasRenderer.prototype.fileYTop = function(filename) {
	var self = this;
	return self._layout.getFileY(filename);
};


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

	self._dirView.render();	
};


CanvasRenderer.prototype.renderHistory = function() {
	console.log("renderHistory");
	var self = this;

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);

	self._repoView.render();
};



CanvasRenderer.prototype.filesDoubleClick = function(event) {
	var self = this;
	// show file history
	if (self._selectedFile) {
		$("#filter_input").val(self._selectedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._selectedFile && self._selectedFile.length > 0) {
		var selectedDir = self._model.isDir(self._selectedFile)
						? self._selectedFile
						: self._model.getParent(self._selectedFile)

		if (selectedDir.length && selectedDir != '/') {
			self._model.toggleOpen(selectedDir);
			self.calculateLayout();
			self.render();
		}
	}
};


CanvasRenderer.prototype.repoClick = function(event) {
	var self = this;
	if (event.offsetX != self._mouseDownPos.x
	|| event.offsetY != self._mouseDownPos.y)
		return;

	self._selectionFrozen = !self._selectionFrozen;
	self.mouseMoveHistoryWindow(event);
};

CanvasRenderer.prototype._endScroll = function() {
	var self = this;
	var from = self._toCommit;
	for (var i=self._fromCommit; i <= self._toCommit; i++) {
		if (!self._model.hasCommit(self._revList[i])) {
			from = i;
			break;
		}
	}
	var to = from;
	for (var i=self._toCommit; i > from; i--) {
		if (!self._model.hasCommit(self._revList[i])) {
			to = i;
			break;
		}	
	}
	if (from < to) {
		var repo = urlParam("repo");
		self._downloader.get("/rangeJSON?repo=" 
			+ repo 
			+ "&from=" + from
			+"&to=" + to,
			self.ajaxDone.bind(self));
	}
}

CanvasRenderer.prototype.mouseMoveHistoryWindow = function(event) {
	var self = this;

	if (event.offsetX == self._lastMouseX 
		&& event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._mouseDown) {
		var commit_width = self._width/(self._toCommit - self._fromCommit + 1);
		var delta = self._xForLastCanvasShift - self._lastMouseX;
		
		var count = Math.round(delta/commit_width);
		if (count != 0) {
			self._isScrolling = true;
			self._scrollCanvas(count);
			self._repoView.render();
			self._xForLastCanvasShift = self._lastMouseX;
		}

		self._lastMouseY = event.offsetY;
		self._lastMouseX = event.offsetX;
		return;
	}

	if (self._selectionFrozen)
		return;

	if (self._lastMouseX != event.offsetX) {
		self._lastMouseX = event.offsetX;
		self._repoView.setSelectedCommit(self.commitIndexFromXCoord(event.offsetX));
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		var file = self.fileFromYCoord(event.offsetY);
		if (file != self._selectedFile) {
			self._selectedFile = file;
			self._repoView.setSelectedFile(file);
			self.renderFilenames();
			self._dirView.setSelectedFile(file);
		}
	}
};

CanvasRenderer.prototype.mouseMoveFilesWindow = function(event) {
	var self = this;
	
	if (self._selectionFrozen)
		return;

	if (event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		var file = self.fileFromYCoord(event.offsetY);
		if (file != self._selectedFile) {
			self._selectedFile = file;
			self._repoView.setSelectedFile(file);
			self._dirView.setSelectedFile(file);
			self.renderFilenames();
		}
	}
};


CanvasRenderer.prototype.mouseDown = function(event) {
	var self = this;
	self._isScrolling = false;
	self._xForLastCanvasShift = event.offsetX;
	self._mouseDownPos.x = event.offsetX;
	self._mouseDownPos.y = event.offsetY;
	self._mouseDown = true;
}

CanvasRenderer.prototype.mouseUp = function(event) {
	var self = this;
	if (self._isScrolling) {
		self._endScroll();
	}
	self._mouseDown = false;
	self._isScrolling = false;
}

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
	if (index >= 0 && self._fromCommit+index <= self._toCommit) {
		return self._fromCommit+index;
	}
	return -1;
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

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}

