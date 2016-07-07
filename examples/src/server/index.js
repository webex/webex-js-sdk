/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var compression = require('compression');
var express = require('express');
var http = require('http');
var morgan = require('morgan');
var path = require('path');

var app = express();

// Configure Logging
// -----------------

if (app.get('env') !== 'production') {
  app.use(morgan('dev', {
    immediate: true
  }));
}
else {
  app.use(morgan('tiny'));
}

// Handle OAuth2 Authorization Code flow
// -------------------------------------
// Disabling the auth code router for now because its use case is pretty
// advanced and we don't have a great way to test it. You probably wanted to use
// Passport anyway
// app.use('/', require('./routers/auth-code'));

// Mount the atlas proxy in its default location
// ---------------------------------------------

app.use('/users/email', require('./routers/atlas'));

// Mount the passport router onto /
// --------------------------------
// (see routers/passport.js for an example of using spark-js-sdk with
// Passport)

app.use('/', require('./routers/passport'));

// Configure Browserify
// --------------------

var browserify = require('browserify-middleware');

app.use('/scripts/', browserify(path.join(__dirname, '../app/scripts/'), {
  debug: true,
  noParse: ['jquery'],
  transform: [
    'envify'
  ]
}));

// Configure LESS
// --------------
var less = require('less-middleware');
var cssCacheDir = path.join(__dirname, '../../.tmp');
app.use(less(path.join(__dirname, '../app'), {
  dest: cssCacheDir,
  compiler: {
    sourceMap: true
  }
}));
var autoprefixer = require('express-autoprefixer');
app.use(autoprefixer({
  browsers: 'last 1 versions',
  map: true
}));
app.use(express.static(cssCacheDir));

// Enable gzip/deflate
// -------------------
app.use(compression());

// Enable static routes
// --------------------
app.use(express.static('src/app'));

// Configure development server to support pushState routes.
// --------------------------------------------------------
// (production server should do this in nginx)

if (app.get('env') !== 'production') {
  app.get(/\/.*/, function(req, res) {
    res.sendFile('index.html', {
      root: path.join(__dirname, '../app')
    });
  });
}

// Start the server
// ----------------

var port = app.get('port') || process.env.PORT || 3000;
http.createServer(app).listen(port, function() {
  console.log('Express server listening on port ' + port);
});
