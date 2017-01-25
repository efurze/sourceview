var git = require('./controllers/git.js');
var Repo = require('./controllers/repo.js');



var ingest = function(dir) {
	var repo = new Repo(dir);
	repo.buildCommitHistory('master');
};

// process.argv[0] == node
// process.argv[1] == process.js
var repo = process.argv[2];
console.log("Reading repository at " + repo);
ingest(repo);

