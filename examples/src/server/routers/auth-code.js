/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint new-cap: [0] */

/**
 * Arguably, this is kind of a hack. In order to properly implement the
 * authorization code flow, you really ought to look at something like
 * passport.
 */

var assign = require('lodash').assign;
var express = require('express');
var pick = require('lodash').pick;
var querystring = require('querystring');
var Spark = require('../../../../src');

var router = express.Router();

var cfg = {
  config: {
    credentials: {
      /* eslint camelcase: [0] */
      oauth: {
        client_id: process.env.COMMON_IDENTITY_CLIENT_ID,
        client_secret: process.env.COMMON_IDENTITY_CLIENT_SECRET,
        redirect_uri: process.env.COMMON_IDENTITY_REDIRECT_URI,
        scope: 'webexsquare:get_conversation Identity:SCIM',
        service: 'spark'
      }
    },
    trackingIdPrefix: 'example-server'
  }
};

router.get('/', function(req, res, next) {
  // Normally we wouldn't need to parse state like this, but we do it here to
  // demonstrate a non-passport oauth flow in this file and the passport-enabled
  // flow via `routers/passport.js`.
  var state = querystring.parse(req.query.state);
  if (req.query && req.query.code && !state.passport) {
    var spark = new Spark(cfg);

    // Call `spark.credentials.authenticate()` directly because we don't want to
    // trigger a device registration (which `spark.authenticate()` does
    // implicitly)
    spark.credentials.authenticate(req.query)
      .then(function() {
        var query = assign({state: req.query.state}, pick(spark.credentials.authorization, 'access_token', 'expires_in', 'token_type'));
        res.redirect('/#' + querystring.stringify(query));
      })
      .catch(function(reason) {
        console.error(reason, reason.statck);
        res.status(500).send(reason.toString());
      });

  }
  else {
    next();
  }
});

module.exports = router;
