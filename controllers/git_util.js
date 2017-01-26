var Promise = require('bluebird');
var Types = require('./types.js');

var Util = function (git) {
	this.git = git;
};


/*
	returns [
		 { 	tree: '22f69063496851bdd4791e4ef0a23659c6ef25d5',
		    author: 'Eric',
		    committer: 'Eric',
		    parents: [],
		    commit_msg: 'Initial commit' 
		 },
	]

	Oldest revision last
*/
Util.prototype.revWalk = function (branch_name) { 
	var self = this;
	return this.git.revList(branch_name)
		.then(function(history) { // array of commit shas
			return Promise.map(history, function(commit) {
				return self.git.catFile(commit);
			});
		});
};

Util.prototype.enumerateFiles = function(tree, path) {
	var self = this;
	var files = [];
	if (path && path.length) {
		path += "/";
	} else {
		path = "";
	}

	tree.children.forEach(function(child) {
		if (child instanceof Node) {
			var subtree = self.enumerateFiles(child, path + child.name);
			files = files.concat(subtree);
		} else {
			files.push(path + child.name);
		}
	});

	return files;
};



/* returns tree node: 
	{
		name: <str>,
		children: [{
			name:,
			id: SHA-1
			type: tree | blob
		}]
	}
*/
Util.prototype.buildTree = function(object) {
	if (typeof(object) == 'string') {
		object = {
			id: object,
			name: "",
			type: "tree"
		};
	} else if (!object || !object.type || object.type !== 'tree' || !object.id)
		return;

	var self = this;

	var innerSync = function(obj) {
		var resolve, reject;
		var promise = new Promise(function(res, rej){
			resolve = res;
			reject = rej;
		});

		var tree = new Node(obj.name);

		self.git.catFile(obj.id).then(function(objs) {
			var subtrees = [];
			if (objs && objs.children) {
				objs.children.forEach(function(obj) {
					if (obj.type === 'tree') {
						subtrees.push(obj);
					} else {
						tree.addChild(obj);
					}
				});
			}

			Promise.all(subtrees.map(function(st) {
				return innerSync(st)
					.then(function (result) {
						tree.addChild(result);
					});
			})).then(function() {
				resolve(tree);
			});
		}).catch(function(err) {
			reject(err);
		});
		return promise;
	};
	return innerSync(object);
};




module.exports = Util;