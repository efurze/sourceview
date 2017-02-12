var Promise = require('bluebird');
var Types = require('./types.js');
var Diff = require('./types/diff.js');

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
var MAX_REVSISIONS = 1000;
Util.prototype.revWalk = function (branch_name) { 
	var self = this;
	return this.git.revList(branch_name)
		.then(function(history) { // array of commit shas
			if (history.length > MAX_REVSISIONS) {
				history = history.slice(0, MAX_REVSISIONS);
			}
			return Promise.mapSeries(history, function(commit, index) {
				status("Adding commit", index, '/', history.length);
				return self.git.catFile(commit);
			});
		});
};

/*
	@tree = {
		name: <str>,
		id: <sha>
		children: [{
			name:,
			id: SHA-1
			type: tree | blob
		}]
	}

	returns: { 
  'Gruntfile.js': 'b17704f5e5a3f1e6640986331c8b40928d1c34c8',
  'README.md': '528e4b414f90bcfdd24447b71e4dc10a5659a332',
  'index.js': '15b17b51df9c751dfabd0509a2d78396f3091b85',
  'package.json': '8e97337ab2dc55cf15b5c05c328a446be44ea975',
  'views/index.hbs': '33144bdbc6b7213cd2ccd944dc7a94ae21fb8beb',
 }
*/
Util.prototype.enumerateFiles = function(tree, path) {
	var self = this;
	var files = {};
	if (path && path.length) {
		path += "/";
	} else {
		path = "";
	}

	if (tree.children) {
		tree.children.forEach(function(child) {
			if (child instanceof Node) {
				var subtree = self.enumerateFiles(child, path + child.name);
				Object.keys(subtree).forEach(function(key) {
					files[key] = subtree[key];
				});
			} else {
				files[path + child.name] = child.id;
			}
		});
	}

	return files;
};


Util.prototype.show = function(tree_sha) {
	var self = this;
	var diffstr = "";

	return self.buildTree(tree_sha)
		.then(function(tree) { // filename to sha
			status("tree built", tree);
			let files = self.enumerateFiles(tree);
			let len = Object.keys(files).length;
			status("diffing", len, "files");
			return Promise.each(Object.keys(files), function(filename, index) {
				if (index % 100 == 0) {
					status("Diffing:", index, "/", len);
				}
				return self.git.catFile(files[filename])
					.then(function(file_contents) {
						if (!file_contents || !file_contents instanceof Array) {
							return;
						}
						diffstr += "diff --git a/" + filename + " b/" + filename + "\n";
						diffstr += "--- a/" + filename + "\n";
						diffstr += "+++ b/" + filename + "\n";
						diffstr += "@@ -0,0 +1," + file_contents.length + " @@\n";
						diffstr += "\n";
					});
				});
		}).then(function() {
			return new Diff(diffstr);
		});
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
		status("tree obj", obj.name);
		var tree = new Node(obj.name, obj.id);

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


var status = function() {
	console.log.apply(console, arguments);
};

module.exports = Util;