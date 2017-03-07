'use strict';


var RepoModel = function(revList) {
	var self = this;
	self._revList = revList;
	self._filesizes = {}; // commit_sha: {filename: length}
	self._diffs = {}; // commit_sha: {filename: diff_summary}
	self._commits = {}; // sha: {message:, date:, author_name:}
	self._blame = {}; // sha: filename : [{from: ,to: , author:}] 
	self._selectedFile = "";

	self._revIndex = {};
	revList.forEach(function(commit, index) {
		self._revIndex[commit] = index;
	});
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


RepoModel.prototype.addData = function(commits, size_history, diff_summaries) {
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

	commits.forEach(function(commit) {
		self._commits[commit.id] = {
			'message': commit.message,
			'date': commit.date,
			'author_name': commit.author_name
		};
	});

	var to = self._revIndex[commits[commits.length-1].id];
	self._updateHistory(to);
/*
	Object.keys(blame).forEach(function(sha) {
		if (!self._blame.hasOwnProperty(sha)) {
			self._blame[sha] = blame[sha];
		}
	});
*/
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


RepoModel.prototype._updateHistory = function(upToIndex) {
	var self = this;
	ASSERT(upToIndex >= 0);

	var sha = self._revList[upToIndex];
	var prev_sha = self._revList[upToIndex-1];
	
	if (!self._filesizes.hasOwnProperty(prev_sha)) {
		self._updateHistory(upToIndex-1);
	}
	
	ASSERT(self._filesizes.hasOwnProperty(prev_sha));
	ASSERT(self._diffs.hasOwnProperty(sha));

	self._filesizes[sha] = self._updateSizes(self._filesizes[prev_sha],
											self._diffs[sha]);
}

RepoModel.prototype._updateSizes = function(sizes, diff) {
	var updated = JSON.parse(JSON.stringify(sizes));

	Object.keys(diff).forEach(function(filename) {
		var delta = 0;
		diff[filename].forEach(function(chunk) {
			// @@ -33,6 +35,12 @@
			// @@ -0,0 +1 @@
			if (!chunk.length) 
				return;
			let parts = chunk.split(" ");

			parts.forEach(function(chunk) {
				if (!chunk.length)
					return;
				let pieces = chunk.split(",");
				let sign = pieces[0].slice(0, 1);
				let count = 0;
				if (pieces.length > 1) {
					count = parseInt(pieces[1]);
				} else if (pieces.length == 1){
					count = 1;
				}
				if (sign === "+") {
					delta += count;
				} else {
					delta -= count;
				}
			});
			if (!updated.hasOwnProperty(filename)) {
				updated[filename] = 0;
			}
		});
		updated[filename] += delta;
	});
	return updated;
}


RepoModel.prototype._updateBlame = function(upToIndex) {
	var self = this;

	// find the most recent revision with blame info
	var index = upToIndex;
	while (index >= 0 && !self._blame.hasOwnProperty(self._revList[index])) {
		index --;
	}

	if (index < 0) {
		index = 0;
		self._blame[self._revList[0]] = {};
	}

	for(index=index+1; index <= upToIndex; index++) {
		self._blame[self._revList[index]] = self._blameForCommit(self._revList[index-1],
													self._revList[index])
	}
}
/*
	@commit_sha : revision to update to
*/
RepoModel.prototype._blameForCommit = function(prev_sha, commit_sha) {
	var self = this;

	var diff = self._diffs[commit_sha];
	var blame = self._blame[prev_sha];
	ASSERT(blame);
	ASSERT(diff);

	/*
	blame =
		{
			filename : [ // sorted by start line
				{
					from: 
					to: 
					author:
				}
			]
		}
	*/

	var updated = JSON.parse(JSON.stringify(blame));

	Object.keys(diff).forEach(function(filename) {

		updated[filename] = arrayify(updated[filename], 
							self._filesizes[commit_sha][filename]);

		var edits = diff[filename]
		edits.forEach(function(edit) { // "-1,8 +1,9"
			var parts = edit.split(' ');
			parts.forEach(function(part) {
				insertEdit(updated[filename], part, commit_sha);
			});
		});

		updated[filename] = chunkify(updated[filename]);
	});

	return updated;
}

/* 
chunks = [{
	from:
	to:
	commit:
}...]
*/
function arrayify(chunks, filelength) {
	var ary = new Array(filelength);
	ary.fill(null);
	if (chunks) {
		chunks.forEach(function(chunk) {
			for (var i=chunk.from; i <= chunk.to; i++) {
				ary[i] = chunk.commit;
			}
		});
	}
	return ary;
}

function chunkify(ary) {
	var chunks = [];
	var chunk;
	var current_commit = "";
	for (var i=0; i < ary.length; i++) {
		if (!ary[i])
			continue;

		if (ary[i] != current_commit) {
			current_commit = ary[i];
			if (chunk) {
				chunk.to = i-1;
				chunks.push(chunk)
			}
			chunk = {
				from: i,
				commit: ary[i]
			}
		} 
	}
	if (chunk) {
		chunk.to = i-1;
		chunks.push(chunk);
	}
	return chunks;
}

/*
	edit: +1,9
*/
function insertEdit(ary, edit, commit_id) {
	var parts = edit.split(",");
	var sign = parts[0].charAt(0);
	var linenum = parseInt(parts[0].slice(1)) - 1;
	var editLen = parseInt(parts[1]);
	if (sign === "+") {
		for (var i=0; i<editLen; i++) {
			if (!ary[i+linenum]) {
				ary[i+linenum] = commit_id;
			} else {
				ary.splice(i+linenum, 0, commit_id);
			}
		}
	} else {
		ary.splice(linenum, editLen);
	}
}

