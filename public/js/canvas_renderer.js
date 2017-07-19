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
var CanvasRenderer = function(revList, repoName) {
	Logger.INFO("CanvasRenderer()", Logger.CHANNEL.RENDERER);


	const self = this;
	this._ANTIALIAS = false;
	this._repoName = repoName;

	this._canvas = document.getElementById("canvas");
	this._context = this._canvas.getContext('2d');

	this._width = this._canvas.width;
	this._height = this._canvas.height;

	this._filesWidth = this._canvas.width * 0.15;
	this._repoWidth = this._width - this._filesWidth;

	$('#top-container').css('margin-left', this._filesWidth);
	$('#commit-container').css('margin-left', this._filesWidth);


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
	this._lastScrollFinish = {
		min: 0,
		max: 0
	};
	this._lastScroll = {
		min: 0,
		max: 0
	};
	this._lastFetchRange = {
		from: -1,
		to: -1
	};
	this._selectionFrozen = false;
	this._scrollTimerId = -1;
	this._model = new RepoModel(revList);


	this._downloader = new Downloader();

	this._layout = new Layout(this._model, this._revList);
	this._layout.setClip(0, 0, this._filesWidth, this._height);
	this._layout.on('resize', this._resize.bind(this));

	this._dirView = new DirectoryView(this._layout, this._context);
	this._dirView.setClip(0, 0, this._filesWidth, this._height);

	this._repoView = new RepoView(this._context, this._model, this._layout, revList);
	this._repoView.setClip(self._filesWidth, 0, self._repoWidth, self._height);

	$(this._canvas).mousemove(this.mouseMove.bind(this));
	$(this._canvas).mousedown(this.mouseDown.bind(this));
	$(this._canvas).click(this.mouseClick.bind(this));
	$(document).mouseup(this.mouseUp.bind(this));
	$("#last_button").on('click', self.onLastClick.bind(self));
	$("#first_button").on('click', self.onFirstClick.bind(self));
	$('#canvas-container').scroll(self.onScroll.bind(self));

	self._initialRequest();
};

CanvasRenderer.prototype._createSlider = function (from, to, revList) {
	var self = this;

	var pixelsPerCommit = self._repoWidth/revList.length;

	self._minSliderSize = Math.ceil(20 / pixelsPerCommit);
	self._lastScrollFinish = {
		min: from, 
		max: Math.max(to, from + self._minSliderSize)
	}

	self._lastScroll = {
		min: from, 
		max: Math.max(to, from + self._minSliderSize)
	}

	self._scrollbarScaleFactor = (to - from)/(self._lastScrollFinish.to - from);

	self._rangeBar = RangeBar({
          min: 0,
          max: revList.length-1,
          values: [
            [
              from,
              self._lastScrollFinish.max
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
		to = 100,
		commit_width = self._repoWidth/100;

	if (self._ANTIALIAS) {
		commit_width = Math.floor(commit_width);
		to = Math.floor(self._repoWidth/commit_width);
		self._repoWidth = commit_width * (to - from + 1);
	}


	self._fromCommit = from;
	self._toCommit = to;
	self._lastFetchRange.from = from;
	self._lastFetchRange.to = to;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	//self._createSlider(from, to, self._revList);
	self.clearHistory();
	self.render();
	self._fetchMoreData();
}

CanvasRenderer.prototype.updateData = function(commits, initial_size, summaries, from, to) {
	Logger.INFO("updateData", from, "=>", to, Logger.CHANNEL.RENDERER);
	var self = this;
	ASSERT(!isNaN(from));
	ASSERT(!isNaN(to));
	ASSERT(from < to);

	Logger.INFO("adding data to model", Logger.CHANNEL.RENDERER);

	self._model.addData(commits, initial_size, summaries);

	var final_size = self._model.fileSizes(self._revList[to]).getTree();

	if (false) {
		var lineCount = getCount(final_size, 'size');
		if (lineCount > 10 * 1000) {
			self._layout.addFilter("/*");
		}
		Logger.INFO("Line count", lineCount, Logger.CHANNEL.RENDERER);
	} else {
		var fileCount = getCount(final_size, 'files');
		if (fileCount > 1000) {
			//self._layout.addFilter("/*");
		}
		Logger.INFO("File count", fileCount, Logger.CHANNEL.RENDERER);
	}

	


	for (var i=from; i<=to; i++) {
		self._repoView.markCommit(self._revList[i]);
	}
	
	self.calculateLayout();
	self.render();
};


CanvasRenderer.prototype._resize = function(new_height) {
	const self = this;
	self._height = new_height;
	self._canvas.height = new_height;
	self._dirView.setClip(0, 0, self._filesWidth, self._height);
	self._repoView.setClip(self._filesWidth, 0, self._repoWidth, self._height);
}

CanvasRenderer.prototype.calculateLayout = function() {
	Logger.INFO("calculateLayout()", Logger.CHANNEL.RENDERER);
	var self = this;

	self._layout.doLayout(self._fromCommit, self._toCommit);
	self._files = self._layout.displayOrder();
};



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
	Logger.DEBUG("scrollCanvas", count, Logger.CHANNEL.RENDERER);
	var self = this;

	var commit_width = self._repoWidth/(self._toCommit - self._fromCommit + 1);
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
		
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);

	var img = self._context.getImageData(
		self._filesWidth, 
		0, 
		self._repoWidth, 
		self._height);
	
	// clear canvas
	self.clearHistory();

	
	self._context.save();
	self._context.rect(self._filesWidth, 0, self._repoWidth, self._height);
	self._context.clip();
	self._context.putImageData(img, 
		self._filesWidth - (count * commit_width), 
		0);
	self._context.restore();
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.render();
}

CanvasRenderer.prototype._rescaleX = function(from, to) {
	var self = this;
	ASSERT(to < self._revList.length);

	var requestedRange = to - from + 1;
	var newCommitWidth = self._repoWidth / requestedRange;
	var newRange = requestedRange;

	if (self._ANTIALIAS) {
		newCommitWidth = Math.floor(newCommitWidth);
		newRange = Math.floor(self._canvas.width / newCommitWidth);
	}

	var oldFrom = self._fromCommit,
		oldTo = self._toCommit,
		oldRange = self._toCommit - self._fromCommit + 1,
		oldWidth = self._repoWidth,
		commit_width = self._repoWidth/(oldRange);

	if (from == oldFrom) {
		to = Math.min(self._revList.length-1, from + newRange - 1);
	} else {
		from = Math.max(0,to - newRange + 1);
	}
	newRange = to - from + 1;
	if (self._ANTIALIAS)
		self._repoWidth = newRange * newCommitWidth;
	
	if (oldRange > newRange) {
		// expand
		self._repoView.markAll();	
	} else {
		// contract
		var x = 0;
		if (to == oldTo) {
			x = self._repoWidth*(1 - oldRange/newRange); 
		}
		self._context.drawImage(self._canvas, self._filesWidth,0, 
			self._repoWidth, self._height,
			self._filesWidth + x,0,
			self._repoWidth*oldRange/newRange, self._height);
	}

	Logger.INFO("rescaleX", 
		"from", 
		self._fromCommit, "=>", from,
		"to",
		self._toCommit, "=>", to,
		"width",
		Logger.CHANNEL.RENDERER);

	if (oldWidth > self._repoWidth) {
		self._context.fillStyle = COLORS.REPO_BACKGROUND;
		self._context.fillRect(self._repoWidth, 0, oldWidth, self._height);
	}

	self._fromCommit = from;
	self._toCommit = to;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.setClip(self._filesWidth, 0, self._repoWidth, self._height);
	self._fetchMoreData();
	self._repoView.render();
}

CanvasRenderer.prototype.onLastClick = function() {
	var self = this;

	Logger.INFO("onLastClick", Logger.CHANNEL.RENDERER);

	var range = self._toCommit - self._fromCommit;
	self._toCommit = self._revList.length - 1;
	self._fromCommit = self._toCommit - range;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.markAll();
	if (!self._fetchMoreData()) {
		self.calculateLayout()
	}
	self._repoView.render();	
};

CanvasRenderer.prototype.onFirstClick = function() {
	var self = this;

	Logger.INFO("onFirstClick", Logger.CHANNEL.RENDERER);

	var range = self._toCommit - self._fromCommit;
	self._fromCommit = 0;
	self._toCommit = self._fromCommit + range;
	self._repoView.setCommitRange(self._fromCommit, self._toCommit);
	self._repoView.markAll();
	if (!self._fetchMoreData()) {
		self.calculateLayout()
	}
	self._repoView.render();
};

CanvasRenderer.prototype.ajaxDone = function(success, data) {
	Logger.INFO("ajaxDone", Logger.CHANNEL.RENDERER);
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
	Logger.INFO("render", "scrollOffset", $('#canvas-container').scrollTop(), Logger.CHANNEL.RENDERER);
	var self = this;
	self._dirView.render();	
	self._repoView.render();
};


CanvasRenderer.prototype.clearHistory = function() {
	var self = this;

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(self._filesWidth, 0, self._repoWidth, self._height);
	self._context.fillRect(self._filesWidth, 0, self._repoWidth, self._height);
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
	Logger.INFO("filesClick", Logger.CHANNEL.RENDERER);
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

CanvasRenderer.prototype.diffAjaxDone = function(success, data) {
	Logger.INFO("diffAjaxDone", Logger.CHANNEL.RENDERER);
	var self = this;
	if (success) {
		self._model.addDiffData(data);
		const sha = Object.keys(data)[0];
		const filename = self._repoView.getHighlightedFile();
		if (data[sha].hasOwnProperty(filename)) {
			showDiffPopup(data[sha][filename].raw);
		}
	}
};

function showDiffPopup(diffstr) {
	const html = Diff2Html.getPrettyHtml(diffstr);
    const parsed = $(html);
    parsed.find('.d2h-code-linenumber').remove();
    parsed.find('td.d2h-info').remove();
    parsed.find('.d2h-code-line').css('margin-left', '0');
    $('#diff-popup').html(parsed.prop('outerHTML'));
}

// Vertical scroll of canvas
CanvasRenderer.prototype.onScroll = function(event) {
	const self = this;
	self._layout.setScrollOffset($('#canvas-container').scrollTop());
	if (self._scrollTimerId >= 0) {
		clearTimeout(self._scrollTimerId);
		self._scrollTimerId = -1;
	}

	// TODO: only mark the newly-visible files
	self._repoView.markAll();
	self._scrollTimerId = setTimeout(function() {
		self._scrollTimerId = -1;
		self.render();
	}, 250);
}

CanvasRenderer.prototype.mouseClick = function(event) {
	const self = this;

	if (event.offsetX < self._filesWidth) {
		return self.filesClick(event);
	} else {
		return self.repoClick(event);
	}
}

CanvasRenderer.prototype.repoClick = function(event) {
	var self = this;
	if (event.offsetX != self._mouseDownPos.x
	|| event.offsetY != self._mouseDownPos.y)
		return;

	const elem = $("#diff-popup");
	const sha = self._revList[self._repoView.getHighlightedCommit()];
	var diff = self._model.getDiff(sha);
	if (diff) {
		const filename = self._repoView.getHighlightedFile();
		if (diff.hasOwnProperty(filename)) {
			showDiffPopup(diff[filename].raw);
		}
	} else {
		$('#diff-popup').html('');
		const repo = self._repoName;
		self._downloader.get("/diff/" 
			+ repo 
			+ "/" + sha,
			self.diffAjaxDone.bind(self));
	}

	let middle = self._filesWidth + (self._repoWidth/2);

	if(elem.hasClass("show-left")) {
		elem.removeClass("show-left");
	} else if(elem.hasClass("show-right")) {
		elem.removeClass("show-right");
	} else if (event.offsetX < middle) {
		elem.addClass("show-right");
	} else {
		elem.addClass("show-left");
	}

	self._selectionFrozen = !self._selectionFrozen;
	self._repoView.setSelected(self._selectionFrozen);
	self.mouseMoveHistoryWindow(event);
	self._repoView.render();
};

/*
	requests data for anything missing in the current visible range
*/
CanvasRenderer.prototype._fetchMoreData = function() {
	var self = this;
	var request_made = false;
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

	var repo = self._repoName;
	chunks.forEach(function(chunk) {
		request_made = true;
		self._downloader.get("/rangeJSON/" 
			+ repo 
			+ "/" + chunk[0]
			+"/" + chunk[chunk.length-1],
			self.ajaxDone.bind(self));
	});

	return request_made;
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

	self._lastScrollFinish.min = range[0];
	self._lastScrollFinish.max = range[1];
	self._lastScroll.min = range[0];
	self._lastScroll.max = range[1];

	if ((range[1] - range[0]) != (oldTo - oldFrom)) {
		// resized
		self._rescaleX(range[0], range[1]);
	}

	if (self._lastScrollFinish.min != self._lastFetchRange.from) {
		self._repoView.markAll();
		self._repoView.render();
	}

	self._fetchMoreData();
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

	if ((range[1] - range[0]) != (self._lastScrollFinish.max - self._lastScrollFinish.min)) {
		// resize event
		return;
	}

	var SCROLL_THRESHOLD = 10;
	var count = range[0] - self._lastScroll.min;

	self._lastScroll.min = range[0];
	self._lastScroll.max = range[1];
	
	if (count != 0) {
		self._scrollCanvas(count);
		/*
		if (Math.abs(self._lastFetchRange.from - self._fromCommit) 
		>= SCROLL_THRESHOLD) {
			self._fetchMoreData();
			self._lastFetchRange.from = self._fromCommit;
			self._lastFetchRange.to = self._toCommit;
		}
		*/
	}
}

CanvasRenderer.prototype.mouseMove = function(event) {
	const self = this;

	if (event.offsetX < self._filesWidth) {
		return self.mouseMoveFilesWindow(event);
	} else {
		return self.mouseMoveHistoryWindow(event);
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
		if (file && file.length && file != self._highlightedFile) {
			self._highlightedFile = file;
			self._repoView.setHighlightedFile(file);
			self._dirView.setHighlightedFile(file);
			self.render();
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
			self.render();
		}
	}
};


CanvasRenderer.prototype.mouseDown = function(event) {
	const self = this;

	if (event.offsetX >= self._filesWidth) {
		return self.mouseDownHistory(event);
	}
}

CanvasRenderer.prototype.mouseDownHistory = function(event) {
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
	if (!self._files || !self._files.length)
		return '';

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

	x = x - self._repoView.getClipX();
	var width = self._repoView.getClipDX();
	var length = self._toCommit - self._fromCommit + 1;
	var index = Math.floor((length * x) / width);
	if (index >= 0 && self._fromCommit+index <= self._toCommit) {
		return self._fromCommit+index;
	}
	return -1;
}


var getCount = function (size_tree, field) {
	var count = size_tree[field];
	Object.keys(size_tree.children).forEach(function(child) {
		if (typeof(size_tree.children[child]) == 'object') {
			count += getCount(size_tree.children[child], field);
		}
	});

	return count;
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


Logger.channels[Logger.CHANNEL.RENDERER] = Logger.LEVEL.DEBUG;
