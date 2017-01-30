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
"views/layouts/single.hbs": 4,
"views/main.hbs": 0,
"views/partials/includes.hbs": 32,
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

});
