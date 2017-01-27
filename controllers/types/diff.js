'use strict'

var parse = require('parse-diff');


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
	self._summary = {};
/*
	self._parsed = self.parse(diffstr);
	Object.keys(self._parsed).forEach(function(filename) {
		self._summary[filename] = Object.keys(self._parsed[filename]);
	});
*/


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
   { '-169,7 +169,7': 
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
},
*/
Diff.prototype.parse = function(diffstr) {
	var self = this;
	var lines = diffstr.split('\n');

	var files = {};
	var file, chunk, linenums, filename;
	lines.forEach(function(line) {
		if (!line) {
			return;
		}
		//console.log(line);
		if (line.startsWith("diff --git")) { // diff --git a/controllers/repo.js b/controllers/repo.js\
			//console.log("new file", line);
			if (chunk && linenums) {
				file[linenums] = chunk;
				chunk = [];
				linenums = null;
			}
			if (file) {
				files[filename] = file;
			}
			var parts = line.split(' ');
			var from = parts[2];
			var to = parts[3];
			filename = from;
			if (!filename || filename === '/dev/null') {
				filename = to;
			}
			filename = filename.slice(2);
			file = {}; // "-33,6 +35,12" : array of lines
		} else if (line.startsWith("+++") || line.startsWith("---")) {
			// skip
		} else if (line.startsWith("@@")) { // @@ -33,6 +35,12 @@ var CanvasRenderer = function(range_data, history_data, diffs) {
			//console.log("new chunk");
			if (chunk && linenums) {
				file[linenums] = chunk;
			}
			chunk = [];
 			linenums = line.split('@@')[1].trim();
		} else if (linenums) {
			chunk.push(line);
		}
	});

	if (chunk && file && filename && filename) {
		file[linenums] = chunk;
		files[filename] = file;
	}

	return files;
}


Diff.prototype.parse_diff = function() {
	return this._parsed;
}

module.exports = Diff;