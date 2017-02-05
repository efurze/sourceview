var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Git = require('../controllers/git.js');
var git = new Git('/Users/efurze/repos/linux');
var Util = require('../controllers/git_util.js');
var util = new Util(git);


describe('show test', function() {
  it('should generate diff', function(done) {
  	this.timeout(0);
    util.show('56b49224928af6acbdf44403396885db92338422').then(function(result) {
    	console.log(result);
    	done();
    });
  });
});

describe('revWalk test', function() {
  it('should show history for 8th commit', function(done) {
    util.revWalk('88d3a143dd95071ad609d76d97c5c036a2d1673a').then(function(result) {
    	//console.log(result);
    	expect(result.length).to.equal(8);
    	done();
    });
  });
});