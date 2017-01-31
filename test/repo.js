var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Repo = require('../controllers/repo.js');
var repo = new Repo(__dirname + '/..');
var Diff = require("../controllers/types/diff.js");

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
var eighth_commit =  { 
    'Gruntfile.js': 85,
   'README.md': 2,
   'index.js': 78,
   'package.json': 47,
   'views/index.hbs': 8,
   'views/main.hbs': 6,
   'views/layouts/single.hbs': 13,
   'views/partials/head.hbs': 17,
   'views/partials/includes.hbs': 18,
   'views/partials/nav.hbs': 12,
   'controllers/git.js': 117,
   'controllers/git_util.js': 114,
   'controllers/persist.js': 59,
   'controllers/repo.js': 177,
   'controllers/types.js': 17,
   'controllers/types/diff.js': 69,
   'public/js/renderer.js': 36,
   'test.js': 35 
};

var first_diff =  { 
  commit: 
     { id: '9f2ac93709d0d5c7fe1bfd1493e29e2f6ab71f8f',
       tree: '1b4d8b6bdd49783aa93e6aa6e480c6b556bdc38c',
       author: 'Eric',
       committer: 'Eric',
       commit_msg: 'Added bonsai\n' },
    diffs: 
     {'views/index.hbs': [ '-1,5', '+1,13' ],
    'views/layouts/single.hbs': [ '-4', '+3,0' ],
    'views/main.hbs': [ '-2,2', '+2' ],
    'views/partials/includes.hbs': [ '-16', '+16' ] } 
};

describe('diffHistory', function() {
    var history;
    it('should generate diff history for 8th commit in this repo', function(done) {
        repo.diffHistory('88d3a143dd95071ad609d76d97c5c036a2d1673a').then(function(result) {
            history = result;
            expect(result).to.have.lengthOf(8);
            done();
        });
    });
    it('should have accurate data for first diff', function() {
        Object.keys(first_diff.diffs).forEach(function(file) {
          console.log(file);
            expect(history[6].diffs.summary(file)).to.deep.equal(first_diff.diffs[file]);
        });
    });
});

describe('fileSizeHistory', function() {
    var history;
    it('should generate file size history for 8th commit in this repo', function(done) {
        repo.fileSizeHistory('88d3a143dd95071ad609d76d97c5c036a2d1673a').then(function(result) {
            history = result;
            //console.log(history);
            expect(result).to.have.lengthOf(8);
        	done();
        });
    });

    it('should have accurate data for each commit', function(done) {
      for (let index=history.length-1; index >= 0; index--) {
        let commit = history[index];
        console.log("COMMIT ID", commit.commit);
        console.log("EXPECTED", file_size_history[index].tree);
        console.log("ACTUAL", commit.tree);
        expect(commit.tree).to.deep.equal(file_size_history[index].tree);
      }
      done();
    });
});

var file_size_history = [
  { commit: '88d3a143dd95071ad609d76d97c5c036a2d1673a',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 78,
       'package.json': 47,
       'views/index.hbs': 8,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'controllers/git.js': 117,
       'controllers/git_util.js': 114,
       'controllers/persist.js': 59,
       'controllers/repo.js': 177,
       'controllers/types.js': 17,
       'controllers/types/diff.js': 69,
       'public/js/renderer.js': 36,
       'test.js': 35 } },
  { commit: '46a867561caa7c26111a33f90759dece0d42b57d',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 60,
       'package.json': 47,
       'views/index.hbs': 8,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'controllers/git.js': 117,
       'controllers/git_util.js': 114,
       'controllers/persist.js': 59,
       'controllers/repo.js': 177,
       'controllers/types.js': 17,
       'controllers/types/diff.js': 69,
       'public/js/renderer.js': 21,
       'test.js': 35 } },
  { commit: '22f69063496851bdd4791e4ef0a23659c6ef25d5',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 60,
       'package.json': 43,
       'views/index.hbs': 8,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'public/js/renderer.js': 21} },
  { commit: '109b8ca38666d6b9c28eee7779dfe8ef002080bf',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 60,
       'package.json': 43,
       'views/index.hbs': 13,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'public/js/renderer.js': 19} },
  { commit: '72b0786458df83bc155031b627e0ecea643a1c0f',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 60,
       'package.json': 43,
       'views/index.hbs': 8,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'public/js/renderer.js': 23 } },
  { commit: '2d0bd1bfb71005ae788d8f8f54e0dcb9c32832c6',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 57,
       'package.json': 43,
       'views/index.hbs': 10,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12,
       'public/js/renderer.js': 5} },
  { commit: '9f2ac93709d0d5c7fe1bfd1493e29e2f6ab71f8f',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 57,
       'package.json': 43,
       'views/index.hbs': 14,
       'views/main.hbs': 6,
       'views/layouts/single.hbs': 13,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12 } },
  { commit: 'a95b74d50734f36458cef910edc7badf38b49fec',
    tree: 
     { 'Gruntfile.js': 85,
       'README.md': 2,
       'index.js': 57,
       'package.json': 43,
       'views/index.hbs': 6,
       'views/main.hbs': 7,
       'views/layouts/single.hbs': 14,
       'views/partials/head.hbs': 17,
       'views/partials/includes.hbs': 18,
       'views/partials/nav.hbs': 12 } } 
];


