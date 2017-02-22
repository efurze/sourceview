var git = require('./lib/git.js');
var Digest = require('./lib/digest.js');
let Logger = require('./lib/logger.js');



var ingest = function(dir, max, start) {
	var digest = new Digest(dir);
	digest.buildBranchInfo2('master', start, max);
};


// process.argv[0] == node
// process.argv[1] == process.js
//Logger.disable_logging();
var repo = process.argv[2];
console.log("Reading repository at " + repo);

var max = 0;
var start = 0;

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
	}
});

ingest(repo, max, start);

