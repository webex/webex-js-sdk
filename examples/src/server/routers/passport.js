/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint new-cap: [0] */

var express = require('express');
var expressCiscoCommonIdentity = require('express-cisco-common-identity');
var session = require('express-session');

var router = express.Router();

router.use(session({
  secret: 'keyboard cat'
}));

router.use('/', expressCiscoCommonIdentity({
  callbackPath: '/',
  loginPath: '/login',
  logoutPath: '/logout',
  goto: '/',
  refreshPath: '/refresh'
}));

module.exports = router;
