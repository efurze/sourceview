var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Git = require('../controllers/git.js');
var git = new Git(__dirname + '/..');
var Util = require('../controllers/git_util.js');
var util = new Util(git);


describe('revWalk test', function() {
  it('should show history', function(done) {
    util.revWalk('master').then(function(result) {
    	console.log(result);
    	done();
    });
  });
});