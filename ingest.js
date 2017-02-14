var git = require('./lib/git.js');
var Digest = require('./lib/digest.js');
let Logger = require('./lib/logger.js');



var ingest = function(dir, max) {
	var digest = new Digest(dir);
	digest.buildBranchInfo('master', max);
};


// process.argv[0] == node
// process.argv[1] == process.js
//Logger.disable_logging();
var repo = process.argv[2];
console.log("Reading repository at " + repo);

var max = 0;
if (process.argv.length > 3 && process.argv[3].startsWith("-max")) {
	var parts = process.argv[3].split('=')
	if (parts.length > 1) {
		max = parseInt(parts[1]);
		console.log("Limiting ingestion to", max, "commits");
	}
}

ingest(repo, max);

