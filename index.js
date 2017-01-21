var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');

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
		res.render("index", {
			title: "Source View",
			scripts: [
				{ path: "/js/renderer.js" }
			]
		});	    
});


app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});


module.exports = app;

