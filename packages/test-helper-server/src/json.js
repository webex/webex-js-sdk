/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var bodyParser = require('body-parser');
var express = require('express');
var reflect = require('./reflect');

/* eslint new-cap: [0] */
var router = express.Router();

// Configure JSON processing
// -------------------------

router.use(bodyParser.json());

router.get('/get', function(req, res) {
  res.send({
    isObject: true
  });
});

router.patch('/set', reflect);
router.post('/set', reflect);
router.put('/set', reflect);

module.exports = router;
