var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Git = require('../lib/git.js');
var git = new Git(__dirname + '/..');

describe('diff test', function() {
  it('should diff 2 revisions', function(done) {
    git.diff('22f69063496851bdd4791e4ef0a23659c6ef25d5',
        '109b8ca38666d6b9c28eee7779dfe8ef002080bf').then(function(result) {
        console.log(JSON.stringify(result));
        done();
    });
  });
});

describe('catFile test', function() {
  it('should cat the current commit object', function(done) {
    git.catFile('109b8ca38666d6b9c28eee7779dfe8ef002080bf').then(function(result) {
    	console.log(result);
      expect(result).to.have.property('id');
    	expect(result).to.have.property('tree');
    	expect(result).to.have.property('author_name');
      expect(result).to.have.property('author_email');
    	expect(result).to.have.property('committer');
    	expect(result).to.have.property('parents');
    	expect(result).to.have.property('message');
    	done();
    });
  });

describe('revList test', function() {
  it('should list revision history', function(done) {
    git.revList('22f69063496851bdd4791e4ef0a23659c6ef25d5').then(function(result) {
        console.log(result);
        done();
    });
  });
});
});