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
	this._scrollTimerId = -1;
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
	this._dirView = DirectoryView;
	this._dirView.init(this._filesContext)
	this._dirView.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._repoView = new RepoView(this._context, revList);
	this._repoView.setClip(0, 0, this._canvas.width, this._canvas.height);
};

CanvasRenderer.prototype.setData = function(commits, initial_size, summaries, from, to) {
	var self = this;
	self._fromCommit = from;
	self._toCommit = to;
	self._dirView.setModel(self._model);
	self._repoView.setData(self._model, self._fromCommit, self._toCommit);
	self._updateData(commits, initial_size, summaries, from, to);
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

	// blame
	var blame = {}; // sha: {filename : [{from: to: author:}]}
	blame[commits[0].id] = {};
	for (var i=1; i<commits.length; i++) {
		var sha = self._revList[from+i];
		blame[sha] = self._updateBlame(blame[self._revList[from+i-1]],
									summaries[sha],
									commits[i]);
	}	

	self._model.addData(commits, history, summaries, blame);

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

/*
	@blame = {
			filename : [ // sorted
			{
				from: 
				to: 
				author:
			}
		]
	}
*/
CanvasRenderer.prototype._updateBlame = function(blame, diff, commit) {
	var self = this;
	var updated = {};

	ASSERT(blame);
	ASSERT(commit);

	Object.keys(diff).forEach(function(filename) {
		updated[filename] = [];
		var edits = diff[filename]
		edits.forEach(function(edit) { // "+1,9"
			var parts = edit.split(",");
			var linenum = parseInt(parts[0].slice(1));
			var editLen = parseInt(parts[1]);

			var newChunk = {
				from: linenum,
				to: linenum + editLen,
				author: commit.author_name || commit.author_email
			};

			
			if (!blame.hasOwnProperty(filename)) {
				updated[filename].push(newChunk);
			} else {
				// TODO: optimize this - don't have to go through every chunk here
				blame[filename].forEach(function(chunk) {
					// chunk = {from, to, author}
					updated[filename] = updated[filename].concat(merge(chunk, newChunk));
				});
			}

		});
	});

	return updated;
}

function merge(chunk1, chunk2) {
	if (chunk1.from > chunk2.to)
		return [chunk1, chunk2];
	if (chunk1.to < chunk2.from)
		return [chunk2, chunk1];

	var newChunks = [];
	var first, second;
	if (chunk1.from < chunk2.from) {
		first = chunk1;
		second = chunk2;
	} else {
		first = chunk2;
		second = chunk1;
	}

	var newFirst = {
		from: first.from,
		to: second.from-1,
		author: first.author
	};

	newChunks.push(newFirst);
	newChunks.push(second);

	if (second.to < first.to) {
		var third = {
			from: second.to + 1,
			to: first.to,
			author: first.author
		};
		newChunks.push(third);
	}

	return newChunks;
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

CanvasRenderer.prototype.calculateLayout = function() {
	console.log("calculateLayout()");
	var self = this;

	self._dirView.layout();
	self._files = self._dirView.displayOrder(); // sorted in display order, top-to-bottom

	var layout = {}; //filename: {y:, dy:}
	self._files.forEach(function(filename) {
		if (self._model.isVisible(filename)) {
			layout[filename] = {
				y: self._dirView.getFileY(filename),
				dy: self._dirView.getFileDY(filename)
			};
		}
	});
	self._repoView.setYLayout(layout);
};


// in pixels
CanvasRenderer.prototype.fileYTop = function(filename) {
	var self = this;
	return self._dirView.getFileY(filename);
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
	if (self._dirView.handleFilesClick(event)) {
		self.calculateLayout();
		self.render();
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
			self._scrollCanvas(count);
			self._repoView.render();
			self._xForLastCanvasShift = self._lastMouseX;
		}

		if (self._scrollTimerId >= 0) {
			clearTimeout(self._scrollTimerId);
			self._scrollTimerId = -1;
		}

		self._scrollTimerId = setTimeout(function() {
			self._scrollTimerId = -1;
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
		}, 200);


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
			self._dirView.setSelectedFile(file);
			self.renderFilenames();
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
	self._xForLastCanvasShift = event.offsetX;
	self._mouseDownPos.x = event.offsetX;
	self._mouseDownPos.y = event.offsetY;
	self._mouseDown = true;
}

CanvasRenderer.prototype.mouseUp = function(event) {
	var self = this;
	self._mouseDown = false;
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

