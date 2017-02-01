'use strict'

//var parse = require('parse-diff');
var Logger = require('../../lib/logger.js');


/*

parse-diff output:

[ // one array entry for each file changed
  { 
	chunks: [
      {
    	"content":"@@ -1,8 +1,12 @@",
    	"changes":[
    		{"type":"add","add":true,"ln":1,"content":"+var Promise = require('bluebird');"},
    		{"type":"add","add":true,"ln":2,"content":"+var parse = require('parse-diff');"},{"type":"add","add":true,"ln":3,"content":"+"},
    	]

	  }
	],
    deletions: 61,
    additions: 56,
    from: 'git.js',
    to: 'git.js',
    index: [ 'dbfe933..8e4f0eb', '100644' ] 
  },
]
*/

var Diff = function(diffstr) { // git diff output
	var self = this;

	Logger.TRACE("RAW diff str", diffstr, Logger.CHANNEL.DIFF);

	self._parsed = self.parse(diffstr);
	Object.keys(self._parsed).forEach(function(filename) {
		Logger.INFO("Summary", filename, 
			self._parsed[filename]['summary'], 
			"delta",
			self.delta(filename),
			Logger.CHANNEL.DIFF);
	});



//	Object.keys(self._parsed).forEach(function(filename) {
//		self._summary[filename] = Object.keys(self._parsed[filename]);
//	});


/*
	self._parsed = parse(diffstr);
	self._parsed.forEach(function(file) {
		// TODO: handle renames
		var filename = file.from;
		if (!filename || filename === '/dev/null') {
			filename = file.to;
		}

		self._summary[filename] = [];
		file.chunks.forEach(function(chunk) {
			var linenums = chunk.content.split('@@')[1].trim();
			var ary = linenums.split(' '); // ["-73,13", "+72,5"]
			self._summary[filename] = self._summary[filename].concat(ary);
			//console.log(chunk.content.split('@@')[1]); 
		});
	});
*/
	/*
	self._summary:
	{
		"git.js":["-1,8","+1,12","-14,77","+18,68"],
		"git_util.js":["-0,0","+1,130"],
		"package.json":["-12,6","+12,14"],
		"repo.js":["-0,0","+1,118"]
	}
	*/
};

/*
returns:
{
 'controllers/repo.js': 
 {
  summary: ['-169,7 +169,7', ],
  chunks: { '-169,7 +169,7': 
      [ '                                        return self._git.diff(history[index+1].id, commit.id)',
        '                                                .then(function(diff) {',
        '                                                        delete commit.parents;',
        '-                                                       console.log(JSON.stringify(diff));',
        '+                                                       //console.log(JSON.stringify(diff));',
        '                                                        return {',
        '                                                                ',
        '"commit',
        '": commit,',
        '                                                                ',
        '"diffs',
        '": diff._summary' 
        ]
 } 
},
*/
Diff.prototype.parse = function(diffstr) {
	var self = this;
	var lines = diffstr.split('\n');

	var files = {};
	var file, chunk, linenums, from, to;
	var filediff;
	var filediffs = {};
	var chunks = {};
	lines.forEach(function(line) {
		if (!line) {
			return;
		}
		Logger.DEBUGHI("line", line, '\n', Logger.CHANNEL.DIFF);
		

		if (line.startsWith("diff --git")) { // diff --git a/controllers/repo.js b/controllers/repo.js\
			Logger.INFOHI("new file", line, Logger.CHANNEL.DIFF);
			
			if (chunk && linenums) {
				chunks[linenums] = chunk;
				file['chunks'] = chunks;
				chunk = [];
				chunks = {};
				linenums = null;
			}
			if (file) {
				var filename = from === "/dev/null" ? to : from;
				files[filename] = file;
			}
			file = {}; // {"chunks": {"-33,6 +35,12" : array of lines}}
		} else if (line.startsWith("+++ ")) { // +++ a/git.js
			// to
			to = line.slice(3).trim();
			if (to != "/dev/null") {
				to = to.slice(to.indexOf('/')+1); // strip off the "a/"
			}
			Logger.INFOHI("TO file", to, Logger.CHANNEL.DIFF);
		} else if (line.startsWith("--- ")) { // --- b/git.js
			// from
			from = line.slice(3).trim();
			if (from != "/dev/null") {
				from = from.slice(from.indexOf('/')+1); // strip off the "b/"
			}
			Logger.INFOHI("FROM file", from, Logger.CHANNEL.DIFF);
		} else if (line.startsWith("@@")) { // @@ -33,6 +35,12 @@ var CanvasRenderer = function(range_data, history_data, diffs) {
			//console.log("new chunk");
			if (chunk && linenums) {
				chunks[linenums] = chunk;
			}
			chunk = [];
 			linenums = line.split('@@')[1].trim();
 			Logger.DEBUGHI("New Chunk", line, Logger.CHANNEL.DIFF);
		} else if (linenums) {
			chunk.push(encodeURI(line));
		}

		if (line.startsWith("diff --git")) { // diff --git a/controllers/repo.js b/controllers/repo.js\
			if (filediff) {
				filediffs[filename] = encodeURI(filediff.join('\n'));
				filediff = null;
			} else {
				filediff = [line];
			}
		} else if (filediff) {
			filediff.push(line);
		}
	});

	if (filediff) {
		filediffs[filename] = encodeURI(filediff.join('\n'));
	}

	if (chunk && chunks && file && linenums) {
		var filename = from === "/dev/null" ? to : from;
		chunks[linenums] = chunk;
		file['chunks'] = chunks;
		files[filename] = file;
	}

	if (files) {
		Object.keys(files).forEach(function(filename) {
			files[filename]['summary'] = [];
			if (files[filename]['chunks']) {
				Object.keys(files[filename]['chunks'])
					.forEach(function(chunk) {  // -33,6 +35,12
						files[filename]['summary'] = files[filename]['summary'].concat(chunk.split(' '));
					});
				delete files[filename].chunks;
			}
			files[filename].raw = filediffs[filename];
		});
	}


	return files;
}

Diff.prototype.filenames = function() {
	return Object.keys(this._parsed);
}

Diff.prototype.summary = function(filename) {
	if (this._parsed.hasOwnProperty(filename)) {
		return this._parsed[filename].summary;
	} else {
		return [];
	}
}

Diff.prototype.data = function() {
	return this._parsed;
}

Diff.prototype.delta = function(filename) {
	let self = this;
	var delta = 0;
	if (self._parsed.hasOwnProperty(filename)) {
		self._parsed[filename].summary.forEach(function(diff) {
			Logger.DEBUG("delta(): calculating delta", filename, "chunk:", diff, Logger.CHANNEL.DIFF);
			let parts = diff.split(",");
			let sign = parts[0].slice(0, 1);
			let count = 0;
			if (parts.length > 1) {
				count = parseInt(parts[1]);
			} else {
				count = 1;
			}
			Logger.DEBUG("delta(): lines changed", count, Logger.CHANNEL.DIFF);
			if (sign === "+") {
				delta += count;
			} else {
				delta -= count;
			}
		});
	}
	Logger.INFOHI("delta():", filename, delta, Logger.CHANNEL.DIFF);
	return delta;
}

Diff.prototype.clone = function() {
	return JSON.parse(JSON.stringify(this));
};

Diff.prototype.toString = function() {
	var self = this;
	return JSON.stringify(self._parsed);
}


module.exports = Diff;