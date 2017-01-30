var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Git = require('../controllers/git.js');
var git = new Git(__dirname + '/..');
var Util = require('../controllers/git_util.js');
var util = new Util(git);


describe('revWalk test', function() {
  it('should show history for 8th commit', function(done) {
    util.revWalk('88d3a143dd95071ad609d76d97c5c036a2d1673a').then(function(result) {
    	//console.log(result);
    	expect(result.length).to.equal(8);
    	done();
    });
  });
});