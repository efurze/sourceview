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

	this._offset = 0;

	this._revCount = revCount;

	this._selectedFile = "";
	this._filter = "";

	$(this._canvas).mousemove(this.mouseMoveHistoryWindow.bind(this));
	//$(this._canvas).dblclick(this.historyDoubleClick.bind(this));
	$("#filenames").mousemove(this.mouseMoveFilesWindow.bind(this));
	//$("#filenames").dblclick(this.filesDoubleClick.bind(this));
	$("#filenames").click(this.filesClick.bind(this));
	//$("#filter_button").on('click', self.onFilterClick.bind(self));
	$("#next_button").on('click', self.onNextClick.bind(self));
	$("#back_button").on('click', self.onPrevClick.bind(self));


	this._downloader = new Downloader();	
	this._dirView = new DirectoryView("/", null);
	this._dirView.setClip(0, 0, this._filesCanvas.width, this._filesCanvas.height);

	this._repoView = new RepoView(this._context);
	this._repoView.setClip(0, 0, this._canvas.width, this._canvas.height);
};

CanvasRenderer.prototype.setData = function(revList, model, from, to) {
	var self = this;
	self._revList = revList;
	self._model = model;
	self._fromAbs = from;
	self._toAbs = to;

	self._dirView.setModel(model);
	self._repoView.setData(model, revList);

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

/*
	if (self._toCommit >= self._revCount-1)
		return;

	self._fromCommit++;
	self._toCommit++;

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);
	self._offset --;
	
	var img = self._context.getImageData(0,0,self._width, self._height);
	
	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);

	self._context.putImageData(img, -commit_width, 0);


	var repo = urlParam("repo");

	if (self._toCommit >= self._revList.length
		|| !self._model.hasCommit(self._revList(self._toCommit)))
	{
		var from = self._toCommit;
		var to = Math.min(self._revCount, from + 10);
		self._downloader.get("/rangeJSON?repo=" + repo + "&from="+from+"&to="+to,
			self.ajaxDone.bind(self));
	}
*/
	
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
/*
	self._fromCommit--;
	self._toCommit--;
	

	var commit_width = self._width/(self._toCommit - self._fromCommit + 1);
	self._offset ++;

	var img = self._context.getImageData(0,0,self._width, self._height);

	self._context.fillStyle = COLORS.REPO_BACKGROUND;
	self._context.strokeStyle = COLORS.REPO_BACKGROUND;
	self._context.clearRect(0, 0, self._width, self._height);
	self._context.fillRect(0, 0, self._width, self._height);

	self._context.putImageData(img, commit_width, 0);
*/
	
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

	self._dirView.renderDirectories(self._filesContext);	
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
		self._repoView.setSelectedCommit(self.commitIndexFromXCoord(event.offsetX));
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		self._repoView.setSelectedFile(self.fileFromYCoord(event.offsetY));
	}
};

CanvasRenderer.prototype.mouseMoveFilesWindow = function(event) {
	var self = this;
	if (event.offsetY == self._lastMouseY ) {
		return;
	}

	if (self._lastMouseY != event.offsetY) {
		self._lastMouseY = event.offsetY;
		self._repoView.setSelectedFile(self.fileFromYCoord(event.offsetY));
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



var urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return results[1] || 0;
    }
}

