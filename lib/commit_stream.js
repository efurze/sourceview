var Readline = require('readline');
var Logger = require('./logger.js');
var Diff = require('./types/diff.js');

var CommitStream = function(istream) {
	var self = this;
	self._count = 0;
	self._stream = istream;

	self._rl = Readline.createInterface({
		input: istream,
	});

	self._rl.on('close', self._onClose.bind(self));
	self._rl.on('error', self._onError.bind(self));
	self._rl.on('line', self._onLine.bind(self));
	
	self._pauseDepth = 0;
	self._paused = false;

	self.pause();

	self._handlers = {};

	self._buffer = [];


	self._firstOne = true;
	self._inCommitHeader = false;
	self._readingDiff = false;
	self._diff_str = "";
	self._commit_header_str = "";
};

CommitStream.prototype.pause = function() {
	var self = this;
	self._pauseDepth++;
	if (self._pauseDepth > 0) {	
		self._paused = true;
		self._rl.pause();
	}
}

CommitStream.prototype.resume = function() {
	var self = this;
	self._pauseDepth--;
	if (self._pauseDepth <= 0) { 
		self._paused = false;
		self._dequeue();
		if (!self._paused) {
			self._rl.resume();
		}
	}
}

/*
	'commit' event emits: {
		info:
		diff:
	}
*/
CommitStream.prototype.on = function(event, cb) {
	var self = this;
	self._handlers[event] = cb;
}

CommitStream.prototype._endOfCommit = function() {
	var self = this;

	self._inCommitHeader = true;
	self._readingDiff = false;
	if (self._commit_header_str 
		&& self._commit_header_str.length) { 
		// we have a previous commit - send it
		var commit = {
			info: {},
			diff: null
		}

		// parse commit meta
		commit.info = parseCommitHeader(self._commit_header_str);
		self._commit_header_str = "";
		Logger.ASSERT(commit.info.id);

		// parse diff
		if (self._diff_str && self._diff_str.trim().length) {
			commit.diff = new Diff(self._diff_str);
		} 
		self._diff_str = "";

		self._enqueue(commit);
	}
}

CommitStream.prototype._enqueue = function(commit) {
	var self = this;

	self._buffer.push(commit);
	self._dequeue();
}

CommitStream.prototype._dequeue = function() {
	var self = this;

	if (self._buffer.length > 0 && !self._paused) {
		var commit = self._buffer.shift();
		// emit commit object
		self._count ++;
		if (self._handlers['commit']) {
			self._handlers['commit'](commit);
		}

		if (self._buffer.length > 0 && !self._paused) {
			setImmediate(self._dequeue.bind(self));
		}
	}
}

CommitStream.prototype._onLine = function(line) {
	var self = this;

	line += '\n';
	if (line.startsWith("commit ")) { // start of commit
		self._endOfCommit();
		self._commit_header_str = line;
	} else if (line.startsWith("diff --git")) { // start of file diff
		if (self._inCommitHeader) {
			self._inCommitHeader = false;
			self._readingDiff = true;
			self._diff_str = "";
		}
		self._diff_str += line;
	} else if (self._inCommitHeader) {
		self._commit_header_str += line;
	} else if (self._readingDiff) {
		self._diff_str += line;
	}
}

CommitStream.prototype._onClose = function() {
	console.log("ReadStream closed");

	var self = this;
	self._endOfCommit();
	if (self._handlers['close']) {
		self._handlers['close']();
	}
}

CommitStream.prototype._onError = function(err) {
	var self = this;
	console.log("CommitStream error", err);
	if (self._handlers['error']) {
		self._handlers['error'](err);
	}
}



/*
@header = 
'commit a95b74d50734f36458cef910edc7badf38b49fec
Author: Eric Furze <efurze@yahoo-inc.com>
Date:   Fri Jan 20 23:33:21 2017 -0800

    Initial commit

'
*/
function parseCommitHeader(header) {
	var lines = header.split('\n');
	var parsed = {
		id: "",
		author_name: "",
		author_email: "",
		date: "",
		message: ""
	};
	var parts;
	lines.forEach(function(line) {
		if (line.startsWith('commit ')) {
			parts = line.split(' ');
			parsed.id = parts[1];
			Logger.ASSERT(parsed.id.length == 40);
		} else if (line.startsWith('Author: ')) {
			var match = "Author: ";
			line = line.substr(line.indexOf(match) + match.length);
			var open = line.lastIndexOf('<');
			var close = line.lastIndexOf('>');
			parsed.author_name = line.substr(0, open-1).trim();
			parsed.author_email = line.substring(open+1, close);
		} else if (line.startsWith('Date: ')) {
			var tag = "Date: ";
			parsed.date = line.substr(line.indexOf(tag)+tag.length).trim();
		} else if (line.trim().length > 0){
			parsed.message += line.trim() + '\n';
		}
	});

	Logger.ASSERT(parsed.id && parsed.id.length == 40);
	return parsed;
}

module.exports = CommitStream;