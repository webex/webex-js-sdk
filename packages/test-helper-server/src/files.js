/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var bodyParser = require('body-parser');
var express = require('express');
var path = require('path');
var reflect = require('./reflect');

/* eslint new-cap: [0] */
var router = express.Router();

// Configure Image processing
// -------------------------

router.use(bodyParser.raw('image/*'));

router.patch('/reflect', reflect);
router.post('/reflect', reflect);
router.put('/reflect', reflect);

router.use('/get', express.static(path.join(__dirname, 'static')));

module.exports = router;
