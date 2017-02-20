var Logger = require("./logger.js");

var DiffParser = function() {
	var self = this;
	self._handlers = {};
}


DiffParser.prototype.parse = function(diffstr) {
	var self = this;
	self._chunkBuffer = "";

	self._inCommit = false;
	self._inCommitHeader = false;
	self._inDiff = false;
	self._inChunk = false;

	var lines = diffstr.split('\n');
	lines.forEach(function(line, index) {
		self._line(line);
	});

	self._close();
}

/*
supported events:
commit
diff
*/

DiffParser.prototype.on = function(event, cb) {
	var self = this;
	self._handlers[event] = cb;
}

DiffParser.prototype._line = function(line) {
	var self = this;

	if (self._chunkBuffer.length) {
		line = self._chunkBuffer + ' ' + line;
	}

	if (line.startsWith("diff --git")) { 
		self._diffHeader(line);
	} else if (line.startsWith("@@")) {
		self._chunkHeader(line);
	} else if (line.startsWith("commit ")) { // start of commit
		self._commitHeader(line);
	} else if (line.startsWith("+++ ") && !self._inChunk) { // 'from' file 
		self._fromFile(line);
	} else if (line.startsWith("--- ") && !self._inChunk) { // 'to' file 
		self._toFile(line);
	}

	if (self._inDiff) {
		self._rawDiff += line + '\n';
	}
}

DiffParser.prototype._close = function() {
	var self = this;
	self._diffHeader();
}

DiffParser.prototype._diffHeader = function(line) {
	// EX: diff --git a/controllers/repo.js b/controllers/repo.js
	var self = this;
	self._inChunk = false;
	if (self._inDiff) {
		var filename = self._fromFilename === "/dev/null" 
			? self._toFilename 
			: self._fromFilename;

		if (self._handlers["diff"]) {
			var diff = {
				'summary': self._chunks,
				'raw': self._rawDiff
			};
			self._handlers["diff"](filename, diff);
		}
	}

	self._fromFilename = "";
	self._toFilename = "";
	self._rawDiff = "";
	self._chunks = [];

	self._inDiff = true;
	self._inCommitHeader = false;
}

DiffParser.prototype._commitHeader = function(line) {
	// EX: commit a95b74d50734f36458cef910edc7badf38b49fec
	var self = this;
	self._inChunk = false;
	if (self._inCommit) {

	}

	self._inCommit = true;
	self._inCommitHeader = true;
	self._inDiff = false;
}

DiffParser.prototype._chunkHeader = function(line) {
	// EX: @@ -33,6 +35,12 @@ var CanvasRenderer = function()
	// EX: @@ -0,0 +1 @@
	var self = this;
	self._inChunk = true;

	var parts = line.split('@@');
	if (parts.length <= 2) {
		self._chunkBuffer = line.replace('\n', '');
		return;
	}
	self._chunkBuffer = "";

	var linenums = parts[1].trim(); // "-33,6 +35,12"
	self._chunks.push(linenums);
}

DiffParser.prototype._fromFile = function(line) {
	// EX: +++ a/git.js
	var self = this;
	self._fromFilename = line.slice(3).trim();
	if (self._fromFilename != "/dev/null") {
		// strip off the "a/"
		self._fromFilename = self._fromFilename.slice(self._fromFilename.indexOf('/')+1); 
	}
}

DiffParser.prototype._toFile = function(line) {
	// EX: --- a/git.js
	var self = this;
	self._toFilename = line.slice(3).trim();
	if (self._toFilename != "/dev/null") {
		// strip off the "a/"
		self._toFilename = self._toFilename.slice(self._toFilename.indexOf('/')+1); 
	}
}


module.exports = DiffParser;