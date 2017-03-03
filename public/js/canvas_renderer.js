'use strict'

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

	this._highlightedFile = "";
	this._filter = "";
	this._mouseDown = false;
	this._mouseDownPos = {
		x: -1,
		y: -1
	};
	this._scrollbarScaleFactor = 1;
	this._lastScroll = {
		min: 0,
		max: 0
	};
	this._lastFetchRange = {
		from: -1,
		to: -1
	};
	this._selectionFrozen = false;
	this._model = new RepoModel(revList);


	this._downloader = new Downloader();

	this._layout = new Layout(this._model, this._revList);
	this._layout.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._dirView = new DirectoryView(this._layout, this._filesContext);
	this._dirView.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._repoView = new RepoView(this._context, this._model, this._layout, revList);
	
	self._initialRequest();
};

CanvasRenderer.prototype._createSlider = function (from, to, revList) {
	var self = this;

	var pixelsPerCommit = self._width/revList.length;

	self._minSliderSize = Math.ceil(20 / pixelsPerCommit);
	self._lastScroll = {
		min: from, 
		max: Math.max(to, from + self._minSliderSize)
	}

	self._scrollbarScaleFactor = (to - from)/(self._lastScroll.to - from);

	self._rangeBar = RangeBar({
          min: 0,
          max: revList.length-1,
          values: [
            [
              from,
              self._lastScroll.max
            ],

          ],
          minSize: self._minSliderSize,
          label: function(a){return '';},
          snap: 1
        });

	self._rangeBar.on('changing', self._sliderChanging.bind(self));
	self._rangeBar.on('change', self._sliderChanged.bind(self));
	$('#slider-div').prepend(self._rangeBar.$el);
}

CanvasRenderer.prototype._initialRequest = function() {
	var self = this;
	var from = 0, 
		to = 0;

	var commit_width = Math.floor(self._width/100);
	var to = Math.floor(self._width/commit_width);

	self._width = commit_width * (to+1);
	self._repoView.setClip(0, 0, self._width, self._height);

	self._fromCommit = from;
	self._toCommit = to;
	self._lastFetchRange.from = from;
	self._lastFetchRange.to = to;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._createSlider(from, to, self._revList);
	self.clearHistory();
	self.renderFilenames();
	self._fetchMoreData();
}

CanvasRenderer.prototype.updateData = function(commits, initial_size, summaries, from, to) {
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


	var files = Object.keys(history[self._revList[to]]);
	if (files.length > 500) {
		// collapse all dirs
		self._layout.layout(self._fromCommit, self._toCommit);
		self._layout.updateFileList();
		self._layout.closeAll();
	}

	for (var i=from; i<=to; i++) {
		self._repoView.markCommit(self._revList[i]);
	}
	
	self.calculateLayout();
	self.render();


	blame = from > 0 
			? self._model.getBlame(self._revList[from-1])
			: {};
	var counter = 0;
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

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	$(this._canvas).mousedown(this.mouseDown.bind(this));
	$(this._canvas).click(this.repoClick.bind(this));
	$(document).mouseup(this.mouseUp.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	$("#filenames").click(this.filesClick.bind(this));
	$("#next_button").on('click', self.onLastClick.bind(self));
	$("#back_button").on('click', self.onFirstClick.bind(self));

};


CanvasRenderer.prototype.calculateLayout = function() {
	console.log("calculateLayout()");
	var self = this;

	self._layout.layout(self._fromCommit, self._toCommit);
	self._files = self._layout.displayOrder();
};


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
	self.clearHistory();

	self._context.putImageData(img, -(count*commit_width), 0);
	self._repoView.render();
}

CanvasRenderer.prototype._rescaleX = function(from, to) {
	var self = this;
	ASSERT(to < self._revList.length);

	var requestedRange = to - from + 1;
	var newCommitWidth = Math.floor(self._canvas.width / requestedRange);
	var newRange = Math.floor(self._canvas.width / newCommitWidth);

	var oldFrom = self._fromCommit,
		oldTo = self._toCommit,
		oldRange = self._toCommit - self._fromCommit + 1,
		commit_width = self._width/(oldRange);

	if (from == oldFrom) {
		to = Math.min(self._revList.length-1, from + newRange - 1);
	} else {
		from = Math.max(0,to - newRange + 1);
	}
	newRange = to - from + 1;
	self._width = newRange * newCommitWidth;
	
	if (oldRange > newRange) {
		// expand
		self._repoView.markAll();	
	} else {
		// contract
		var x = 0;
		if (to == oldTo) {
			x = self._width*(1 - oldRange/newRange); 
		}
		self._context.drawImage(self._canvas, 0,0, 
			self._width, self._height,
			x,0,
			self._width*oldRange/newRange, self._height);
	}

	self._fromCommit = from;
	self._toCommit = to;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.setClip(0, 0, self._width, self._height);
	self._fetchMoreData();
	self._repoView.render();
}

CanvasRenderer.prototype.onLastClick = function() {
	var self = this;

	var range = self._toCommit - self._fromCommit;
	self._toCommit = self._revList.length - 1;
	self._fromCommit = self._toCommit - range;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.markAll();
	self._fetchMoreData();
	self._repoView.render();	
};

CanvasRenderer.prototype.onFirstClick = function() {
	var self = this;

	var range = self._toCommit - self._fromCommit;
	self._fromCommit = 0;
	self._toCommit = self._fromCommit + range;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.markAll();
	self._fetchMoreData();
	self._repoView.render();
};

CanvasRenderer.prototype.ajaxDone = function(success, data) {
	var self = this;
	if (success) {
		self.updateData(data.commits, data.size_history, data.diff_summaries,
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
	self._repoView.render();
};

CanvasRenderer.prototype.renderFilenames = function() {
	var self = this;

	self._filesContext.fillStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.strokeStyle = COLORS.FILES_BACKGROUND;
	self._filesContext.clearRect(0, 0, self._filesWidth, self._height);
	self._filesContext.fillRect(0, 0, self._filesWidth, self._height);

	self._dirView.render();	
};


CanvasRenderer.prototype.clearHistory = function() {
	var self = this;

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);
};


CanvasRenderer.prototype.filesDoubleClick = function(event) {
	var self = this;
	// show file history
	if (self._highlightedFile) {
		$("#filter_input").val(self._highlightedFile);
		self.onFilterClick();
	}
};

CanvasRenderer.prototype.filesClick = function(event) {
	var self = this;
	if (self._highlightedFile && self._highlightedFile.length > 0) {
		var selectedDir = self._layout.isDir(self._highlightedFile)
						? self._highlightedFile
						: self._layout.getParent(self._highlightedFile)

		if (selectedDir.length && selectedDir != '/') {
			self._layout.toggleOpen(selectedDir);
			self.calculateLayout();
			self._repoView.markAll();
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
	self._repoView.setSelected(self._selectionFrozen);
	self.mouseMoveHistoryWindow(event);
	self._repoView.render();
};


CanvasRenderer.prototype._fetchMoreData = function() {
	var self = this;
	var from = Math.max(0, self._fromCommit-10),
		to = Math.min(self._revList.length-1, self._toCommit + 10);

	var chunks = [];
	var chunk = [];
	for (var i=from; i<=to; i++) {
		if (self._model.hasCommit(self._revList[i])) {
			if (chunk.length)
				chunks.push(chunk);
			chunk = [];
		} else {
			chunk.push(i);
		}
	}

	if (chunk.length)
		chunks.push(chunk);

	var repo = urlParam("repo");
	chunks.forEach(function(chunk) {
		self._downloader.get("/rangeJSON?repo=" 
			+ repo 
			+ "&from=" + chunk[0]
			+"&to=" + chunk[chunk.length-1],
			self.ajaxDone.bind(self));
	});
}

// scroll done
CanvasRenderer.prototype._sliderChanged = function(event, range) {
	var self = this;
	range = range[0];
	range[0] = Math.round(range[0]);
	range[1] = Math.round(range[1]);

	self._isScrolling = false;
	var oldFrom = self._lastScroll.min;
	var oldTo = self._lastScroll.max;

	self._lastScroll.min = range[0];
	self._lastScroll.max = range[1];

	if ((range[1] - range[0]) != (oldTo - oldFrom)) {
		// resized
		self._rescaleX(range[0], range[1]);
	}

	if (self._lastScroll.min != self._lastFetchRange.from) {
		self._repoView.markAll();
		self._repoView.render();
	}
}

// scroll in progress
CanvasRenderer.prototype._sliderChanging = function(event, range) {
	var self = this;
	range = range[0];
	range[0] = Math.round(range[0]);
	range[1] = Math.round(range[1]);
	if (!self._isScrolling) {
		// begin scroll
		self._isScrolling = true;
		self._lastFetchRange.from = self._fromCommit;
		self._lastFetchRange.to = self._toCommit;
	}

	if ((range[1] - range[0]) != (self._lastScroll.max - self._lastScroll.min)) {
		// resize event
		return;
	}

	var SCROLL_THRESHOLD = 10;
	var count = range[0] - self._lastScroll.min;
	
	if (count != 0) {
		self._scrollCanvas(count);
		if (Math.abs(self._lastFetchRange.from - self._fromCommit) 
		>= SCROLL_THRESHOLD) {
			self._fetchMoreData();
			self._lastFetchRange.from = self._fromCommit;
			self._lastFetchRange.to = self._toCommit;
		}
	}
}

CanvasRenderer.prototype.mouseMoveHistoryWindow = function(event) {
	var self = this;

	if (self._isScrolling)
		return;

	if (event.offsetX == self._lastMouseX 
		&& event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._mouseDown) {
		self._lastMouseY = event.offsetY;
		self._lastMouseX = event.offsetX;
		return;
	}

	if (self._selectionFrozen)
		return;

	if (self._lastMouseX != event.offsetX) {
		self._lastMouseX = event.offsetX;
		self._repoView.setHighlightedCommit(self.commitIndexFromXCoord(event.offsetX));
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		var file = self.fileFromYCoord(event.offsetY);
		if (file != self._highlightedFile) {
			self._highlightedFile = file;
			self._repoView.setHighlightedFile(file);
			self._dirView.setHighlightedFile(file);
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
		if (file != self._highlightedFile) {
			self._highlightedFile = file;
			self._repoView.setHighlightedFile(file);
			self._dirView.setHighlightedFile(file);
			self.renderFilenames();
		}
	}
};


CanvasRenderer.prototype.mouseDown = function(event) {
	var self = this;
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
	ASSERT(self._files);
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
	if (y >= self.fileYTop(self._files[next_index])) 
		index = next_index;

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

