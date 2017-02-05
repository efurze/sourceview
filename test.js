var Git = require('./controllers/git.js');
var git = new Git('/Users/efurze/repos/linux');
var Util = require('./controllers/git_util.js');
var util = new Util(git);
var repo = require('./controllers/repo.js');
var Repo = new repo('/Users/efurze/repos/sourceview');
var Diff = require('./controllers/types/diff.js');
var simple_git = require('simple-git')('/Users/efurze/repos/sourceview');


var first_commit = { 
    'Gruntfile.js': 85,
   'README.md': 2,
   'index.js': 57,
   'package.json': 43,
   'views/index.hbs': 6,
   'views/main.hbs': 7,
   'views/layouts/single.hbs': 14,
   'views/partials/head.hbs': 17,
   'views/partials/includes.hbs': 18,
   'views/partials/nav.hbs': 12 
};

var diff = new Diff(first_commit);

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

