/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var cookieParser = require('cookie-parser');
var express = require('express');

/* eslint new-cap: [0] */
var router = express.Router();

// Enable cookies
// --------------

router.use(cookieParser());

router.get('/set', function(req, res) {
  res.status(200).cookie('oreo', 'double stuf').send().end();
});

router.get('/expect', function(req, res) {
  if (req.cookies.oreo === 'double stuf') {
    res.status(200).send().end();
  }
  else {
    res.status(403).send().end();
  }
});

module.exports = router;
