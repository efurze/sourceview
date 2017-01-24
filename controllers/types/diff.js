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



Diff.prototype.parse_diff = function() {
	return this._parsed;
}

module.exports = Diff;