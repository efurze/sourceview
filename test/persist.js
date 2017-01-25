var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Repo = require('../controllers/repo.js');
var repo = new Repo(__dirname + '/..');
var Persist = require('../controllers/persist.js');
var persist = new Persist('unittest');

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

describe('saveFileSizeHistory', function() {
	var loadedHistory;
	it('should save and load fileSizeHistory', function(done) {
		repo.fileSizeHistory('88d3a143dd95071ad609d76d97c5c036a2d1673a').then(function(result) {
			persist.saveFileSizeHistory('unittest', result)
				.then(function() {
					return persist.getFileSizeHistory('unittest');
				}).then(function(result) {
					loadedHistory = result;
					expect(loadedHistory).to.have.lengthOf(8);
					done();
				});
		});	
	});
	it('should have accurate data for first commit', function() {
        Object.keys(first_commit).forEach(function(file) {
            expect(loadedHistory[7].tree[file]).to.equal(first_commit[file]);
        });
        Object.keys(loadedHistory[7].tree).forEach(function(file) {
            expect(loadedHistory[7].tree[file]).to.equal(first_commit[file]);
        });
    });
    it('should have accurate data for eighth commit', function() {
        Object.keys(first_commit).forEach(function(file) {
            expect(loadedHistory[0].tree[file]).to.equal(eighth_commit[file]);
        });
        Object.keys(loadedHistory[0].tree).forEach(function(file) {
            expect(loadedHistory[0].tree[file]).to.equal(eighth_commit[file]);
        });
    });
});