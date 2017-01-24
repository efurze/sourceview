var git = require('./controllers/git.js');
var Git = new git('/Users/efurze/repos/sourceview');
var util = require('./controllers/git_util.js');
var Util = new util(Git);
var repo = require('./controllers/repo.js');
var Repo = new repo('/Users/efurze/repos/sourceview');
var simple_git = require('simple-git')('/Users/efurze/repos/sourceview');


//Repo.buildCommitHistory('master');

/*
Repo.fileSizeHistory('master').then(function(file_lengths) {
	console.log(file_lengths);
});
*/
/*
Git.catFile('master').then(function(data){
	console.log(data);
});
*/

/*
Util.revWalk('master').then(function(msgs) {
	console.log(msgs);
})
*/


Util.buildTree('22f69063496851bdd4791e4ef0a23659c6ef25d5').then(function(data) {
	console.log(JSON.stringify(data));
	//console.log(Util.enumerateFiles(data, ""));
});


