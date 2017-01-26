var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Repo = require('../controllers/repo.js');
var repo = new Repo(__dirname + '/..');

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
            //console.log(history);
            expect(result).to.have.lengthOf(7);
            done();
        });
    });
    it('should have accurate data for first diff', function() {
        Object.keys(first_diff).forEach(function(file) {
            expect(history[6][file]).to.deep.equal(first_diff[file]);
        });
        Object.keys(history[6]).forEach(function(file) {
            expect(history[6][file]).to.deep.equal(first_diff[file]);
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
    it('should have accurate data for first commit', function() {
        Object.keys(first_commit).forEach(function(file) {
            expect(history[7].tree[file]).to.equal(first_commit[file]);
        });
        Object.keys(history[7].tree).forEach(function(file) {
            expect(history[7].tree[file]).to.equal(first_commit[file]);
        });
    });
    it('should have accurate data for eighth commit', function() {
        Object.keys(first_commit).forEach(function(file) {
            expect(history[0].tree[file]).to.equal(eighth_commit[file]);
        });
        Object.keys(history[0].tree).forEach(function(file) {
            expect(history[0].tree[file]).to.equal(eighth_commit[file]);
        });
    });
});