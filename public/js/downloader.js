
var MAX_RETRIES = 5;

var Downloader = function() {
	this._array = [];
	this._retryCount = 0;
	this._pending = false;
	this._timeout = 10;
};

Downloader.prototype.hasPending = function() {
	return this._pending;
};

// @callback: function(success, msg) - if success == true, msg = http response. if success == false, msg = err
Downloader.prototype.get = function(url, callback) {
	LOG("Push url", url);
	this._array.push({url: url, cb: callback});
	this._doNext();
};


Downloader.prototype._doNext = function() {
	var self = this;
	if (!self._pending && self._array.length) {
		
		self._pending = true;
		
		window.setTimeout(function() {
			var url = self._array[0].url;
			LOG("Download url", url);
			$.get(url)
			.done(function(d) {
				self.ajaxDone(d);
			}).fail(function(err) {
				self.ajaxFail(err);
			});
			
		}, self._timeout);
	}
};

Downloader.prototype.ajaxDone = function(data) {
	var self = this;
	self._timeout = 10;
	self._retryCount = 0;
	var req = self._array.shift();
	LOG("Got url", req.url);
	self._pending = false;
	if (req && req.cb) {
		req.cb(true, data);
	}
	self._doNext();
};

Downloader.prototype.ajaxFail = function(err) {
	LOG("DOWNLOAD FAILURE: ", err.error(), JSON.stringify(err));
	var self = this;
	self._retryCount++;
	if (self._retryCount > MAX_RETRIES) {
		self._retryCount = 0;
		self._timeout = 10;
		var req = self._array.shift();
		if (req && req.cb) {
			req.cb(false, err);
		}
	} else {
		if (self._timeout < 10000) {
			self._timeout = self._timeout * 5;
		}
		self._pending = false;
		self._doNext();
	}
};

function LOG() {
	console.log.apply(console, arguments);
};