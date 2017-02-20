'use strict'

var parse = require('parse-diff');
var Logger = require('../logger.js');
var DiffParser = require('../diff_parser.js');

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
	self._parsed = {};

	Logger.TRACE("RAW diff str", diffstr, Logger.CHANNEL.DIFF);

	if (diffstr) {
		var parser = new DiffParser();
		parser.on('diff', self._onDiff.bind(self));
		parser.parse(diffstr);
		Logger.INFO("Summary", 
				JSON.stringify(self.diffSummary()), 
				Logger.CHANNEL.DIFF);

	}





//	Object.keys(self._parsed).forEach(function(filename) {
//		self._summary[filename] = Object.keys(self._parsed[filename]);
//	});

/*
	self._parsed = {};
	var parsed = parse(diffstr);
	parsed.forEach(function(file) {
		// TODO: handle renames
		var filename = file.from;
		if (!filename || filename === '/dev/null') {
			filename = file.to;
		}

		self._parsed[filename] = {
			'summary': []
		};
		file.chunks.forEach(function(chunk) {
			var linenums = chunk.content.split('@@')[1].trim();
			var ary = linenums.split(' '); // ["-73,13", "+72,5"]
			self._parsed[filename].summary = self._parsed[filename].summary.concat(ary);
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


Diff.prototype.parseNumstat = function(numstat) {
	var self = this;
	self._parsed = {};
	numstat.split('\n').forEach(function(line) {
		// [ '143', '0', 'public/js/file_view.js' ]
		var parts = line.split('\t');
		if (parts && parts.length > 2) {
			var name = parts[2].trim();
			var count = parseInt(parts[0]);
			if (name && name.length && !isNaN(count)) {
				self._parsed[name] = {
					'summary': ["-0,0", "+1," + count]
				};
			}
		}
	});
}

Diff.prototype._parse = function(diff) {
	let self = this;
	if (typeof diff === 'string') {
		return self._parseStr(diff);
	} else if (typeof diff == 'object') {
		return self._parseFromFilesizes(diff);
	}
};


Diff.prototype._parseFromFilesizes = function(first_rev) {
	let self = this;
	let files = {}
	if (first_rev) {
		Object.keys(first_rev).forEach(function(filename) {
			files[filename] = {
				"summary": ["-0,0", "+1," + first_rev[filename]],
				"raw": {}
			};
			Logger.INFO(filename, files[filename].summary, Logger.CHANNEL.DIFF);
		});
	}
	return files;
}

Diff.prototype._onDiff = function(filename, diff) {
	var self = this;
	if (filename && filename.length)
		self._parsed[filename] = diff;
}
/*
_parsed:
{
 'controllers/repo.js': 
 {
  summary: ['-169,7', '+169,7', ],
  raw: { '-169,7 +169,7': 
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

Diff.prototype.filenames = function() {
	return this._parsed ? Object.keys(this._parsed) : [];
}

Diff.prototype.summary = function(filename) {
	if (this._parsed.hasOwnProperty(filename)) {
		return this._parsed[filename].summary;
	} else {
		return [];
	}
}

Diff.prototype.diffSummary = function() {
	var self = this;
	var summary = {};
	if (self._parsed) {
		self.filenames().forEach(function(filename) {
			summary[filename] = self._parsed[filename].summary;
		});
	}
	return summary;
}

Diff.prototype.data = function() {
	return this._parsed;
}

Diff.prototype.delta = function(filename) {
	let self = this;
	var delta = 0;
	if (self._parsed.hasOwnProperty(filename)) {
		self._parsed[filename].summary.forEach(function(chunk) {
			// @@ -33,6 +35,12 @@
			// @@ -0,0 +1 @@

			if (!chunk.length) 
				return;
			Logger.DEBUG("delta(): calculating delta", filename, "chunk:", chunk, Logger.CHANNEL.DIFF);

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
				Logger.DEBUG("delta(): lines changed", count, Logger.CHANNEL.DIFF);
				if (sign === "+") {
					delta += count;
				} else {
					delta -= count;
				}
			});
			
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