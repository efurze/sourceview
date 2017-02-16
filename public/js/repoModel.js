'use strict';


var RepoModel = function() {
	var self = this;
	self._filesizes = {}; // commit_sha: {filename: length}
	self._diffs = {}; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._range = {}; // filname: length
};

/*
@filesizes: [
	{
		commit: <sha>
		tree: {
			filename: length,
			...
		}
	},
	...
]

@diffs: [
	{
		commit: {
			id: <sha>,
			tree: <sha>,
			commit_msg: <string>
		},
		diffs: {
			filename: {
				summary: ["-119,6","+119,7"],
				raw: <diffstr>
			}
			...
		}
	},
...
]
*/
RepoModel.prototype.setData = function(filesizes, diffs) {
	var self = this;

	// make diffs commit indexed
	diffs.forEach(function(diff) {
		self._diffs[diff.commit.id] = {};
		Object.keys(diff.diffs).forEach(function(filename) {
			self._diffs[diff.commit.id][filename] = diff.diffs[filename].summary;
		});
		self._commits[diff.commit.id] = {
			'message': diff.commit.commit_msg,
			'date': '',
			'author_name': ''
		};
	});

	// make size history indexed by commit
	filesizes.forEach(function(size) {
		self._filesizes[size.commit] = size.tree;
	});

	// initialize range
	filesizes.forEach(function(info) {
		Object.keys(info.tree).forEach(function(filename) {
			if (!self._range.hasOwnProperty(filename)) {
				self._range[filename] = 0;
			}
			self._range[filename] = Math.max(self._range[filename], 
											 info.tree[filename]);
		});
	});

	self._root = new ModelNode('/', true, null);
	self._root.addChildren(Object.keys(self._range));
};


/*

	@commits: [
		{
			hash: <sha>,
			date:
			message:
			author_name:
			author_email:
		},
		...
	]
	
	@size_history: {
		commit_id: {
			filename: length,
			...
		}
		...
	}
	
	@diff_summaries: {
		commit_id: {
			filename: ["-0,0", "+1, 23"],
			...
		}
		...
	}
*/
RepoModel.prototype.setRangeData = function(commits, size_history, diff_summaries) {
	var self = this;
	self._filesizes = size_history; // commit_sha: {filename: length}
	self._diffs = diff_summaries; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._range = {}; // filname: length

	commits.forEach(function(commit) {
		self._commits[commit.hash] = {
			'message': commit.message,
			'date': commit.date,
			'author_name': commit.author_name
		};
	});

	// initialize range
	Object.keys(self._filesizes).forEach(function(sha) {
		var info = self._filesizes[sha];
		Object.keys(info).forEach(function(filename) {
			if (filename && filename.length) {
				if (!self._range.hasOwnProperty(filename)) {
					self._range[filename] = 0;
				}
				self._range[filename] = Math.max(self._range[filename], 
												 info[filename]);
			}
		});
	});

	self._root = new ModelNode('/', true, null);
	self._root.addChildren(Object.keys(self._range));
};

// returns full path of all filenames
RepoModel.prototype.getFilenames = function() {
	var self = this;
	return Object.keys(self._range);
}
/*
returns: {
	filename: ["-119,6","+119,7" ...],
	...
}
*/
RepoModel.prototype.getDiffSummary = function(commit_id) {
	var self = this;
	return self._diffs[commit_id];
}

RepoModel.prototype.getCommitMsg = function(commit_id) {
	var self = this;
	return self._commits[commit_id].message;
}

RepoModel.prototype.getCommitDate = function(commit_id) {
	var self = this;
	return self._commits[commit_id].date;
}

RepoModel.prototype.fileMaxSize = function(filename) {
	return this._range[filename];
}

RepoModel.prototype.fileSize = function(filename, commit_id) {
	if (this._filesizes.hasOwnProperty(commit_id)
		&& this._filesizes[commit_id].hasOwnProperty(filename)) {
		return this._filesizes[commit_id][filename];
	} else {
		return 0;
	}
}

RepoModel.prototype.getParent = function(name) {
	var self = this;
	var parent = null;
	var node = self._getNode(name);
	if (node) {
		parent = node._parent();
	}
	return parent ? parent._name : "";
}

// returns array of names
RepoModel.prototype.getChildren = function(name) {
	var self = this;
	var children = [];
	var node = self._getNode(name);
	if (node) {
		children = node.childNames();
	}
	return children;
}

RepoModel.prototype.visibleLineCount = function(name) {
	var self = this;
	var total = 0;

	var node = self._getNode(name);
	if (node) {
		if (node._isOpen) {
			if (self._range.hasOwnProperty(name)) {
				total += self._range[name];
			}

			node.childNames().forEach(function(child) {
				total += self.visibleLineCount(child);
			});
		}
	}
	ASSERT(!isNaN(total));
	//LOG("visibleLineCount", name, total);
	return total;
};

RepoModel.prototype._getNode = function(name) {
	var self = this;
	if (!name || name == "" || name == "/") {
		// root node
		return self._root;
	}
	var parts = name.split('/');
	var node = self._root;
	parts.forEach(function(dirname) {
		if (node) {
			node = node.getChild(dirname);
		}
	});
	return node;
}

RepoModel.prototype.setOpen = function(name, isOpen) {
	var self = this;
	var node = self._getNode(name);
	if (node) {
		node._isOpen = isOpen;
	}
};

RepoModel.prototype.toggleOpen = function(name) {
	var self = this;
	var node = self._getNode(name);
	if (node) {
		node._isOpen = !node._isOpen;
	}
};

RepoModel.prototype.isOpen = function(name) {
	var self = this;
	var node = self._getNode(name);
	if (node) {
		return node._isOpen;
	}
	return false;
};

RepoModel.prototype.isDir = function(name) {
	var self = this;
	var node = self._getNode(name);
	if (node) {
		return node._isDir;
	}
	return false;
};


RepoModel.prototype.isVisible = function(name) {
	var self = this;
	var visible = false;
	var node = self._getNode(name);
	while (node) {
		if (node._parent && !node._parent._isOpen) {
			return false;
		}
		node = node._parent;
	}
	return true;
};


//-------------------------------------



var ModelNode = function(name, isDir, parent) {
	var self = this;
	self._name = name;
	self._isOpen = true;
	self._isDir = isDir;
	self._parent = parent;
	self._children = {}; // name to ModelNode
	//LOG("new ModelNode", self.getName());
}

ModelNode.prototype.getChildren = function() {
	var self = this;
	return Object.keys(self._children).map(function(name) {
		return self._children[name];
	});
}

ModelNode.prototype.childNames = function() {
	var self = this;
	return Object.keys(self._children).map(function(name) {
		return self._children[name].getName();
	});
}

ModelNode.prototype.getName = function() {
	var self = this;
	if (!self._parent) {
		return "";
	}

	var name = self._parent.getName();
	if (name.length) {
		name += '/' + self._name;
	} else {
		name = self._name;
	}
	return name;
}

ModelNode.prototype.getChild = function(name) {
	var self = this;
	return self._children[name];
} 

ModelNode.prototype.addChildren = function(filenames) {
	var self = this;

	filenames.forEach(function(filename) {
		if (filename && filename.trim().length) {
			self.addChild(filename);		
		} else {
			ASSERT(false);
		}
	});
};

ModelNode.prototype.addChild = function(filename) {
	var self = this;

	var parts = filename.split('/');
	var dirname = parts[0];
	var dir = self._children[dirname] 
		|| new ModelNode(dirname,  
			parts.length > 1,
			self);
	if (!self._children.hasOwnProperty(dirname)) {
		self._children[dirname] = dir;
	}
	if (parts.length > 1) {
		// pop off the directory name
		parts.shift();
		dir.addChild(parts.join('/'));
	}
}

function LOG() {
	//console.log.apply(console, arguments);
}

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
