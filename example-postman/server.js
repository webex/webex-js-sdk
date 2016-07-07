/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-console: [0] */

require('dotenv').load();

var browserify = require('browserify-middleware');
var compression = require('compression');
var express = require('express');
var http = require('http');
var morgan = require('morgan');
var path = require('path');

var app = express();

// Configure Logging
// -----------------
app.use(morgan('dev', {
  immediate: true
}));

// Enable gzip/deflate
// -------------------
app.use(compression());

// Configure Browserify
// --------------------

app.use('/scripts/', browserify(path.join(__dirname, './src/scripts/'), {
  debug: true,
  noParse: ['jquery'],
  transform: [
    'babelify',
    'envify'
  ]
}));

// Configure PostCSS
// -----------------

// Enable static routes
// --------------------

app.use(express.static('src'));

// Ensure all routes receive index.html if they are not otherwise defined
app.get('*', function handleHTML5Routes(request, response) {
  response.sendFile(path.resolve(__dirname, 'src', 'index.html'))
});

// Start the server
// ----------------

var port = app.get('port') || process.env.PORT || 8000;

http.createServer(app).listen(port, function startServer() {
  console.log('Express server listening on HTTPS on port ' + port);
});
