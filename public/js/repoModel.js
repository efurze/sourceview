'use strict';


var RepoModel = function() {
	var self = this;
	self._filesizes = {}; // commit_sha: {filename: length}
	self._diffs = {}; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._range = {}; // filname: length
	self._blame = {};
	self._selectedFile = "";
	self._addListeners = [];
	self._root = new ModelNode(self, '/', true, null);
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

	self._root.addChildren(Object.keys(self._range));
};

RepoModel.prototype.setSelectedFile = function(filename) {
	var self = this;
	if (self._selectedFile != filename) {
		self._selectedFile = filename;
	}
}

RepoModel.prototype.getSelectedFile = function() {
	var self = this;
	return self._selectedFile;
}

/*

	@commits: [
		{
			id: <sha>,
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
	self._filesizes = {}; // commit_sha: {filename: length}
	self._diffs = {}; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._range = {}; // filname: length

	self._root = new ModelNode(self, '/', true, null);
	self.addData(commits, size_history, diff_summaries);
};

RepoModel.prototype.addData = function(commits, size_history, diff_summaries, blame) {
	var self = this;

	Object.keys(size_history).forEach(function(sha) {
		if (!self._filesizes.hasOwnProperty(sha)) {
			self._filesizes[sha] = size_history[sha];
		}
	});

	Object.keys(diff_summaries).forEach(function(sha) {
		if (!self._diffs.hasOwnProperty(sha)) {
			self._diffs[sha] = diff_summaries[sha];
		}
	});

	Object.keys(blame).forEach(function(sha) {
		if (!self._blame.hasOwnProperty(sha)) {
			self._blame[sha] = blame[sha];
		}
	})

	commits.forEach(function(commit) {
		self._commits[commit.id] = {
			'message': commit.message,
			'date': commit.date,
			'author_name': commit.author_name
		};
	});

	// update range
	var new_files = [];
	Object.keys(size_history).forEach(function(sha) {
		var info = size_history[sha];
		Object.keys(info).forEach(function(filename) {
			if (filename && filename.length) {
				if (!self._range.hasOwnProperty(filename)) {
					self._range[filename] = 0;
					new_files.push(filename);
				}
				self._range[filename] = Math.max(self._range[filename], 
												 info[filename]);
			}
		});
	});

	self._addChildren(new_files);
}

RepoModel.prototype._addChildren = function(files) {
	var self = this;
	files.forEach(function(filename) {
		self._root.addChild(filename);
	});
	
}

RepoModel.prototype.hasCommit = function(commit_id) {
	return this._commits.hasOwnProperty(commit_id);
}

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
	if (self.hasCommit(commit_id))
		return self._diffs[commit_id];
}

RepoModel.prototype.getCommitMsg = function(commit_id) {
	var self = this;
	if (self.hasCommit(commit_id))
		return self._commits[commit_id].message;
}

RepoModel.prototype.getCommitDate = function(commit_id) {
	var self = this;
	if (self.hasCommit(commit_id))
		return self._commits[commit_id].date;
}

RepoModel.prototype.getCommitAuthor = function(commit_id) {
	var self = this;
	if (self.hasCommit(commit_id))
		return self._commits[commit_id].author_name;
}

RepoModel.prototype.getBlame = function(commit_id) {
	var self = this;
	if (self._blame.hasOwnProperty(commit_id))
		return self._blame[commit_id];
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
		parent = node._parent;
	}
	return parent ? parent.getName() : "";
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

RepoModel.prototype.addListener = function(fn) {
	var self = this;
	self._addListeners.push(fn);
}

RepoModel.prototype._emitAdd = function(filename) {
	var self = this;
	self._addListeners.forEach(function(listener) {
		listener(filename);
	});
}

//-------------------------------------



var ModelNode = function(model, name, isDir, parent) {
	var self = this;
	self._model = model;
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
		ASSERT(self._children[name]);
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

	if (filename.endsWith('/')) {
		filename = filename.slice(0, filename.length-1);
	}
	var parts = filename.split('/');
	var name = parts[0];
	var child = self._children[name];
	if (!child) {
		child = new ModelNode(self._model,
					name,  
					parts.length > 1,
					self);
		self._children[name] = child;
		if (self._model) {
			self._model._emitAdd(child.getName());
		}
	}
	if (parts.length > 1) {
		// pop off the directory name
		parts.shift();
		child._isDir = true;
		child.addChild(parts.join('/'));
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
