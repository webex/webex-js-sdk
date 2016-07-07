/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-console: [0] */

'use strict';

var btoa = require('btoa');
var bodyParser = require('body-parser');
var browserify = require('browserify-middleware');
var compression = require('compression');
var cors = require('cors');
var express = require('express');
var fs = require('fs');
var http = require('http');
var morgan = require('morgan');
var path = require('path');

var app = express();

// Configure Logging
// -----------------

if (process.env.DEBUG) {
  app.use(morgan('short', {
    immediate: true
  }));
}

// Configure CORS
// --------------

app.use(cors({
  credentials: true,
  origin: function origin(o, callback) {
    callback(null, true);
  }
}));

// Configure body processing
// -------------------------

app.use(bodyParser.raw({type: 'image/*'}));

// Enable gzip/deflate
// -------------------

app.use(compression());

// Close all connections
// ---------------------

// This *should* help tests run faster in IE, which has a very low number of
// allowed connections to the same origin.
app.use(function(req, res, next) {
  res.set('connection', 'close');
  next();
});

// Configure Browserify
// --------------------
var fixturePath = path.join(__dirname, '..', '..', process.env.PACKAGE, 'test', 'automation', 'fixtures');
var appjs = path.join(fixturePath, 'app.js');

try {
  fs.statSync(appjs);
  app.use('/app.js', browserify(appjs, {
    debug: true,
    transform: [
      'babelify',
      'envify'
    ]
  }));
}
catch (e) {
  // ignore - this just means the subproject in question doesn't need a test app
}

// Enable active routes
// --------------------

app.use('/cookies', require('./cookies'));
app.use('/json', require('./json'));
app.use('/form', require('./form'));
app.use('/files', require('./files'));
app.get('/requires-basic-auth', function(req, res) {
  if (req.headers.authorization === 'Basic ' + btoa('basicuser:basicpass')) {
    res.status(200).send().end();
  }
  else {
    res.status(403).send().end();
  }
});

app.get('/requires-bearer-auth', function(req, res) {
  if (req.headers.authorization === 'Bearer bearertoken') {
    res.status(200).send().end();
  }
  else {
    res.status(403).send().end();
  }
});

app.get('/return-qs-as-object', function(req, res) {
  res.status(200).json(req.query).end();
});

app.get('/embargoed', function(req, res) {
  res.status(451).end();
});

// Enable static routes
// --------------------

app.use(express.static(fixturePath));
app.use(express.static(path.join(__dirname, 'static')));

// Start the server
// ----------------

var port = parseInt(process.env.PORT, 10) || 8000;
http.createServer(app).listen(port, function onServerStart() {
  console.log('Express server listening on port ' + port);
});

var fixtureport = parseInt(process.env.FIXTURE_PORT, 10) || 3000;
http.createServer(app).listen(fixtureport, function onServerStart() {
  console.log('Express server listening on port ' + fixtureport);
});

var corsport = parseInt(process.env.CORS_PORT, 10) || 3002;
http.createServer(app).listen(corsport, function onServerStart() {
  console.log('Express server listening on port ' + corsport);
});
