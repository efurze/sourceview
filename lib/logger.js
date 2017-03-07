var Logger = {

		ERROR: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.ERROR);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		WARN: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.WARN);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		INFO: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.INFO);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},


		INFOHI: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.INFOHI);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		DEBUG: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.DEBUG);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		DEBUGHI: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.DEBUGHI);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		TRACE: function() {
			var args = Array.prototype.slice.call(arguments);
			var ch = args.pop();
			args.push(Logger.LEVEL.TRACE);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		disable_logging: function() {
			Logger.disabled = true;
		},

		// USAGE: debug("my msg", foo, bar, Logger.LEVEL.INFO, Logger.CHANNEL.ENGINE);
	    debug: function() {
	    		
				if (false) {//redirectFn) {
					redirectFn.apply(null, arguments);
				} else {
					var argc = arguments.length;

					var channelIdx = argc - 1;
					var levelIdx = channelIdx - 1;

					if (levelIdx >= 1 && 
						(arguments[channelIdx] < Logger.channelNames.length)) {
						var channel = arguments[channelIdx];
						var level = arguments[levelIdx];
				
						var msg = "";
						var args = arguments;
						Object.keys(arguments).forEach(function(key, idx) {
							if (idx < levelIdx) {
								msg += args[key] + " ";
							}
						});
						if (level <= Logger.channels[channel]
							&& !Logger.disabled) {
							console.log('[' + Logger.levelNames[level] + ']',
								'[' + Logger.channelNames[channel] + ']', 
								msg);
						}

						if (channel != Logger.CHANNEL.DIFF) {
							logBuffer.unshift(
								'[' + Logger.levelNames[level] + '] '
								+ '[' + Logger.channelNames[channel] + '] '
								+ msg.substring(0,150)
							);
							if (logBuffer.length > BUFFER_LENGTH) {
								logBuffer.pop();
							}
						}
				
					} else {
			        	//console.log(title, arguments);
					}
				}
	    },
	
		ASSERT: function (condition) {
			if (!condition) {
				console.log("ASSERTION FAILURE");
				try {
					var err = new Error('assertion');
					console.log(err.stack);
					logBuffer.forEach(function(msg) {
						console.log(msg);
					});
				} catch (e) {}
				debugger;
				process.exit();
				throw new Error("Assertion Failure");
			}
		},
		
	};

var logBuffer = [];
var BUFFER_LENGTH = 100;

Logger.LEVEL = {
	"NONE" 	: 0,
	"ERROR" : 1,
	"WARN" 	: 2,
	"INFO"	: 3,
	"INFOHI" : 4,
	"DEBUG" : 5,
	"DEBUGHI"	: 6,
	"TRACE" : 7 
};

Logger.levelNames = [];
Object.keys(Logger.LEVEL).forEach(function(name, idx) {
	Logger.levelNames[idx] = name;
});


// The order in CHANNEL and channels must match. DON'T CHANGE THESE NUMBERS. To change the loglevel, see Logger.channels below
Logger.CHANNEL = {};
Logger.channelNames = [];
Logger.channels = [];

Logger.ADD_CHANNEL = function(name, level) {
	Logger.CHANNEL[name] = Logger.channels.length;
	Logger.channelNames.push(name);
	Logger.channels.push(level);
};

Logger.ADD_CHANNEL("DIGEST", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("DIFF", Logger.LEVEL.WARN);
Logger.ADD_CHANNEL("GIT", Logger.LEVEL.INFO);


Logger.ADD_CHANNEL("RENDERER", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("REPO_VIEW", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("REPO_MODEL", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("FILE_LAYOUT", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("DOWNLOADER", Logger.LEVEL.INFO);


if (typeof module !== 'undefined' && module.exports){
	module.exports = Logger;
}
