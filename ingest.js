"use strict";

var git = require('./lib/git.js');
var Digest = require('./lib/digest.js');
let Logger = require('./lib/logger.js');



var ingest = function(dir, max, start) {
	var digest = new Digest(dir);
	if (fast) {
		digest.buildBranchInfo2('master', start, max);
	} else {
		digest.buildBranchInfo('master', start, max);
	}
};

var makeRevList = function(dir, max, start) {
	var digest = new Digest(dir);
	digest.saveRevList('master', start, max);
};


// process.argv[0] == node
// process.argv[1] == process.js
//Logger.disable_logging();
var repo = process.argv[2];
console.log("Reading repository at " + repo);

var max = 0;
var start = 0;
var revList = false;
var fast = false;

process.argv.forEach(function(arg, index) {
	if (index < 2)
		return;

	var parts = arg.split('=');

	if (arg.startsWith('-max')) {
		max = parseInt(parts[1]);
		console.log("Limiting ingestion to", max, "commits");
	} else if (arg.startsWith('-start')) {
		start = parseInt(parts[1]);
		console.log("Beginning ingestion at", start);
	} else if (arg.startsWith('-revList')) {
		revList = true;
	} else if (arg.startsWith('-fast')) {
		fast = true;
	}
});

if (revList) {
	makeRevList(repo, max, start);
} else {
	ingest(repo, max, start);
}

