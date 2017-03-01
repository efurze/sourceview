'use strict';


var RepoModel = function(revList) {
	var self = this;
	self._revList = revList;
	self._filesizes = {}; // commit_sha: {filename: length}
	self._diffs = {}; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._blame = {};
	self._selectedFile = "";
	self._files = {}; // all filenames
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

	// add new files
	var new_files = [];
	Object.keys(size_history).forEach(function(sha) {
		var info = size_history[sha];
		Object.keys(info).forEach(function(filename) {
			if (!self._files.hasOwnProperty(filename)) {
				self._files[filename] = true;
				new_files.push(filename);
			}
		});
	});

}

RepoModel.prototype.hasCommit = function(commit_id) {
	return this._commits.hasOwnProperty(commit_id);
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
	else
		return {}
}

RepoModel.prototype.fileSize = function(filename, commit_id) {
	if (this._filesizes.hasOwnProperty(commit_id)
		&& this._filesizes[commit_id].hasOwnProperty(filename)) {
		return this._filesizes[commit_id][filename];
	} else {
		return 0;
	}
}

RepoModel.prototype.fileSizes = function(commit_id) {
	if (this._filesizes.hasOwnProperty(commit_id)) {
		return this._filesizes[commit_id];
	} else {
		return {};
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
