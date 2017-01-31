var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Diff = require('../controllers/types/diff.js');
var Git = require('../controllers/git.js');
git = new Git('/Users/efurze/repos/sourceview');
var Repo = require('../controllers/repo.js');
var repo = new Repo(__dirname + '/..');

let first_diff = {
    "views/index.hbs": 8,
"views/layouts/single.hbs": -1,
"views/main.hbs": -1,
"views/partials/includes.hbs": 0,
};

describe('diff test', function() {
  it('should calculate first diff correctly', function(done) {
    git.diff('a95b74d50734f36458cef910edc7badf38b49fec', '9f2ac93709d0d5c7fe1bfd1493e29e2f6ab71f8f')
        .then(function(diff) { 
            diff.filenames().forEach(function(filename) {
                expect(diff.delta(filename)).to.equal(first_diff[filename]);
            });
            done();
        });
  });

  it('should parse git show() output', function(done) {
    git.show('a95b74d50734f36458cef910edc7badf38b49fec')
        .then(function(diff) { 
          diff.filenames().forEach(function(filename) {
            console.log(filename, diff.delta(filename));
          });
          console.log(diff.toString());
          done();
        });
  });

  it('should calculate first 8 diffs', function(done) {
    repo.diffHistory('88d3a143dd95071ad609d76d97c5c036a2d1673a')
        .then(function(history) { 
            history.forEach(function(diff, index) {
                console.log("EXPECTED", diff_history[index]);
                console.log("ACTUAL", diff);
                diff.diffs.filenames().forEach(function(filename) {
                  expect(diff.diffs.summary(filename)).to.deep.equal(diff_history[index].diffs[filename]);  
                });
                
            });
            done();
        });
  });
});


var diff_history = [
{ commit: 
   { id: '88d3a143dd95071ad609d76d97c5c036a2d1673a',
     tree: '10d16ae3b0357bb3d3e35f715647bafcdfb891ca',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'More work\n' },
  diffs: 
   { 'controllers/persist.js': [ '-9', '+9' ],
     'index.js': [ '-5,0', '+6,3', '-44,5', '+47,11', '-51,0', '+61,9' ],
     'public/js/renderer.js': [ '-6,0', '+7', '-8', '+9,2', '-13,4', '+15,17' ],
     'test.js': [ '-10', '+10', '-29,2', '+29,2', '-34', '+34' ],
     'views/index.hbs': [ '-5', '+5' ] } },
{ commit: 
   { id: '46a867561caa7c26111a33f90759dece0d42b57d',
     tree: '47a1896726837f356ca32807c3ee5773a66e7e23',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'Added the git ingestion stuff\n' },
  diffs: 
   { 'controllers/git.js': [ '-0,0', '+1,117' ],
     'controllers/git_util.js': [ '-0,0', '+1,114' ],
     'controllers/persist.js': [ '-0,0', '+1,59' ],
     'controllers/repo.js': [ '-0,0', '+1,177' ],
     'controllers/types.js': [ '-0,0', '+1,17' ],
     'controllers/types/diff.js': [ '-0,0', '+1,69' ],
     'package.json': [ '-25,0', '+26,2', '-30,0', '+33,2' ],
     'test.js': [ '-0,0', '+1,35' ] } },
{ commit: 
   { id: '22f69063496851bdd4791e4ef0a23659c6ef25d5',
     tree: 'e97f345dc598f9be4713247aff03bc925a13a28e',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'More svg stuff\n' },
  diffs: 
   { 'public/js/renderer.js': [ '-14', '+14,3' ],
     'views/index.hbs': [ '-1,2', '+1', '-6,4', '+4,0' ] } },
{ commit: 
   { id: '109b8ca38666d6b9c28eee7779dfe8ef002080bf',
     tree: 'f242d0c9f7650560c72455ba3c421be5324aaad8',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'Replaced bonsai with svg.js\n' },
  diffs: 
   { 'public/js/renderer.js': [ '-5,0', '+6', '-7,6', '+8,2', '-16,3', '+13,2' ],
     'views/index.hbs': [ '-2,0', '+3', '-5', '+6,5' ],
     'views/partials/includes.hbs': [ '-13,0', '+14', '-16', '+16,0' ] } },
{ commit: 
   { id: '72b0786458df83bc155031b627e0ecea643a1c0f',
     tree: 'b05ffcef17abd841018ffa29605e34f6e266366c',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'More bonsai stuff\n' },
  diffs: 
   { 'index.js': [ '-45,0', '+46,3' ],
     'public/js/renderer.js': [ '-3,3', '+3,21' ],
     'views/index.hbs': [ '-4,5', '+4,3' ] } },
{ commit: 
   { id: '2d0bd1bfb71005ae788d8f8f54e0dcb9c32832c6',
     tree: '2c2677e61caeeeefa381c7bfd051a7bae9793d49',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'Put bonsai code in separate js file\n' },
  diffs: 
   { 'public/js/renderer.js': [ '-0,0', '+1,5' ],
     'views/index.hbs': [ '-2', '+2', '-4,6', '+4,2' ] } },
{ commit: 
   { id: '9f2ac93709d0d5c7fe1bfd1493e29e2f6ab71f8f',
     tree: '1b4d8b6bdd49783aa93e6aa6e480c6b556bdc38c',
     author: 'Eric',
     committer: 'Eric',
     commit_msg: 'Added bonsai\n' },
  diffs: 
   { 'views/index.hbs': [ '-1,5', '+1,13' ],
     'views/layouts/single.hbs': [ '-4', '+3,0' ],
     'views/main.hbs': [ '-2,2', '+2' ],
     'views/partials/includes.hbs': [ '-16', '+16' ] } },
{ commit: 
   { id: 'a95b74d50734f36458cef910edc7badf38b49fec',
     tree: 'd28f92b0f4b360a522db7528914bf7714572fdac',
     author: 'Eric',
     committer: 'Eric',
     parents: [],
     commit_msg: 'Initial commit\n' },
  diffs: 
   { 'Gruntfile.js': [ '-0,0', '+1,85' ],
     'README.md': [ '-0,0', '+1,2' ],
     'index.js': [ '-0,0', '+1,57' ],
     'package.json': [ '-0,0', '+1,43' ],
     'views/index.hbs': [ '-0,0', '+1,6' ],
     'views/main.hbs': [ '-0,0', '+1,7' ],
     'views/layouts/single.hbs': [ '-0,0', '+1,14' ],
     'views/partials/head.hbs': [ '-0,0', '+1,17' ],
     'views/partials/includes.hbs': [ '-0,0', '+1,18' ],
     'views/partials/nav.hbs': [ '-0,0', '+1,12' ] } }
];
