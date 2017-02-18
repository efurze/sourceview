
let Persist = require('./lib/persist.js');
let Logger = require('./lib/logger.js');
let Promise = require('bluebird');


var ingest = function(dir, max, start) {
	var digest = new Digest(dir);
	digest.buildBranchInfo('master', start, max);
};


// process.argv[0] == node
// process.argv[1] == fileHistory.js
//Logger.disable_logging();
var repo = process.argv[2];
var filename = process.argv[3];


Persist.getRevList(repo, 'master')
	.then(function(history) {
		Promise.each(history, function(sha, index) {
			var filesize;
			return Persist.sizeSnapshot(repo, [{hash:sha}])
				.then(function(size) {
					size = size[sha];
					filesize = size.hasOwnProperty(filename) ? size[filename] : 0
					return Persist.diffSummary(repo, [{hash:sha}])
				}).then(function(diff) {
					diff = diff[sha];
					console.log(
						index,
						filesize,
						diff.hasOwnProperty(filename) ? diff[filename] : "",
						sha);
				});
		});
	});
