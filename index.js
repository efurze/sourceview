var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
Promise.promisifyAll(fs);

// Create the app.
var app = express();


app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use('/jquery', express.static(path.join(__dirname, '/node_modules/jquery/dist')));
app.use('/node-uuid', express.static(path.join(__dirname, '/node_modules/node-uuid')));
app.use('/socket.io-client', express.static(path.join(__dirname, '/node_modules/socket.io-client')));
app.use('/bootstrap', express.static(path.join(__dirname, '/node_modules/bootstrap/dist')));
app.use('/font-awesome', express.static(path.join(__dirname, '/node_modules/font-awesome')));

app.use(cookieParser());
app.use(bodyParser.json({limit: '50mb'}));       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

app.set('views', __dirname + '/views');

// Turn on handlebars.
var exphbs = require('express-handlebars');
app.engine('.hbs', exphbs({defaultLayout: 'single', extname: '.hbs'}));
app.set('view engine', '.hbs');



// Store the user in locals for the template.
app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});


// Routes
app.get('/', function(req, res) { 
	var data = {};
	var repo = req.param('repo');
	var dir = __dirname + "/model/data/" + repo + "/";
	fs.readFileAsync(dir + "master.filesizehistory.json")
		.then(function(history) {
			data['history_data'] = history;
			return fs.readFileAsync(dir + "/master.filesizerange.json");	
		}).then(function(range) {
			data['range_data'] = range;
			return fs.readFileAsync(dir + "/master.diffhistory.json");	
		}).then(function(diffs) {
			data['diffs'] = diffs;
			res.render("index", {
				title: "Source View",
				repo_data: data,
				scripts: [
					{ path: "/js/renderer.js" }
				]
			});
		}).catch(function(err) {
			res.send(err.toString());
		});	    
});

app.get('/repo/range', function(req, res) { 
	fs.readFileAsync(__dirname + "/model/data/master.filesizerange.json")
		.then(function(data) {
			res.send(data.toString());
		}).catch(function(err) {
			res.send(err.toString());
		})
});


app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});


module.exports = app;

