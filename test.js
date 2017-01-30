var git = require('./controllers/git.js');
var Git = new git('/Users/efurze/repos/sourceview');
var Util = require('./controllers/git_util.js');
var util = new Util(Git);
var repo = require('./controllers/repo.js');
var Repo = new repo('/Users/efurze/repos/sourceview');
var simple_git = require('simple-git')('/Users/efurze/repos/sourceview');

util.revWalk('master')
	.then(function(history) {
		console.log(history);
	});

/*
Git.revList('master')
	.then(function(history) {
		console.log(history);
	});
*/
//Repo.buildCommitHistory('master');

/*
Repo.fileSizeHistory('9f2ac93709d0d5c7fe1bfd1493e29e2f6ab71f8f')
	.then(function(file_lengths) {
		console.log(file_lengths);
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

