var Git = require('./lib/git.js');
var git = new Git('/Users/efurze/repos/git');

var Digest = require('./lib/digest.js');
var digest = new Digest('/Users/efurze/repos/linux');

var Diff = require('./lib/types/diff.js');
var simple_git = require('simple-git')('/Users/efurze/repos/sourceview');

var Promise = require('bluebird');
var exec = require('child_process').exec;

var persist = require('./lib/persist.js');


git.diff('67d4160712ef07bc7a5bc6790f166ba39d45a82a',
	'ada5853c98c5c0ad84a990cc6ee7365a14555c0f')
	.then(function(diff) {
		console.log(diff.diffSummary());
	});

/*
git.revList('master')
	.then(function(history) {
		history = history.slice(0, 100);
		Promise.each(history, function(id, index) {
			if (index == 0) {
				return;
			}
			console.log(index+1, '/100', id);
			return git.diff(history[index-1], id)
				.then(function(diff) {
					console.log(diff._summary);
				});
		});
	});
*/

//digest.buildBranchInfo('master');

/*
persist.getRevList('git', 'master')
	.then(function(history) {
		history.reverse();
		history = history.slice(0, 1);
		return persist.diffSummary('git', history);
	}).then(function(history) {
		console.log(history);
	});
*/
/*
git.log()
	.then(function(log) {
		console.log(log);
	});
*/

/*
git.commitStat('1cce552cc2a7b0d2ed4a9941c233493810dfb4b5')
	.then(function(stat) {
		console.log(stat);
	});
*/




/*
git.revList('master')
	.then(function(history) {
		console.log(history);
	});
*/
//Repo.buildCommitHistory('master');

/*
git.diff('2f5429b0f92e373cd16d7a38ca5e8da0cf77039a~', '2f5429b0f92e373cd16d7a38ca5e8da0cf77039a')
	.then(function(diff) {
		console.log(diff);
});
*/

/*
Git.catFile('7beaa24ba49717419e24d1f6321e8b3c265a719c').then(function(data){
	console.log("result:", data);
});
*/


