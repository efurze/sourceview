var Git = require('./controllers/git.js');
var git = new Git('/Users/efurze/repos/git');
var Util = require('./controllers/git_util.js');
var util = new Util(git);
var Repo = require('./controllers/repo.js');
var repo = new Repo('/Users/efurze/repos/git');
var Diff = require('./controllers/types/diff.js');
var simple_git = require('simple-git')('/Users/efurze/repos/sourceview');


repo.fileSizesForRevision('e83c5163316f89bfbde7d9ab23ca2e25604af290')
	.then(function(res) {
		console.log(res);
	});

/*
git.commitStat('1cce552cc2a7b0d2ed4a9941c233493810dfb4b5')
	.then(function(stat) {
		console.log(stat);
	});
*/


/*
util.buildTree('cbcdc7c66f7af2839314acdc54c74f8d945ea0bc')
	.then(function(tree) {
		console.log(tree);
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

/*
Util.revWalk('master').then(function(msgs) {
	console.log(msgs);
})
*/

/*
Util.buildTree('1b4d8b6bdd49783aa93e6aa6e480c6b556bdc38c').then(function(data) {
	//console.log(JSON.stringify(data));
	console.log(Util.enumerateFiles(data, ""));
});
*/

