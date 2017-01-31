var Logger = {
	
		INFO: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.INFO);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		INFOLOW: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.INFOLOW);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		INFOHI: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.INFOHI);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		DEBUGLOW: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.DEBUGLOW);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		DEBUGHI: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.DEBUGHI);
			args.push(ch);
			Logger.debug.apply(Logger, args);
		},

		TRACE: function() {
			var args = Array.prototype.slice.call(arguments);
			let ch = args.pop();
			args.push(Logger.LEVEL.TRACE);
			args.push(ch);
			Logger.debug.apply(Logger, args);
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
						if (level <= Logger.channels[channel]) {
							console.log(Logger.levelNames[level],
								Logger.channelNames[channel], 
								msg);
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
				} catch (e) {}
				debugger;
				throw new Error("Assertion Failure");
			}
		},
		
	};

Logger.LEVEL = {
	"NONE" 	: 0,
	"ERROR" : 1,
	"WARN" 	: 2,
	"INFO"	: 3,
	"INFOLOW"	: 3,
	"INFOHI" : 4,
	"DEBUGLOW" : 5,
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

Logger.ADD_CHANNEL("REPO", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("DIFF", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("GIT", Logger.LEVEL.INFO);
Logger.ADD_CHANNEL("GIT_UTIL", Logger.LEVEL.INFO);


if (typeof module !== 'undefined' && module.exports){
	module.exports = Logger;
}
