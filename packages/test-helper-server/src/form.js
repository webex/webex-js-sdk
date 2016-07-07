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

// Configure Image processing
// -------------------------

router.use(bodyParser.urlencoded({extended: true}));

router.patch('/reflect', reflect);
router.put('/reflect', reflect);
router.post('/reflect', reflect);

module.exports = router;
