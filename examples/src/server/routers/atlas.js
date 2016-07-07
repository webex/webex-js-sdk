/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint new-cap: [0] */

var bodyParser = require('body-parser');
var express = require('express');
var pick = require('lodash').pick;
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

var spark = new Spark(cfg);

router.use(bodyParser.json());

router.post('/verify', function(req, res) {
  // TODO sanitize req.body instead of simply forwarding it onto Atlas
  spark.user.register(req.body, {spoofMobile: true})
    .then(function(atlasRes) {
      // Ideally, we'd do a 302 redirect to the OAuth login page here, but I'm
      // not sure how to verify the CSRF token if we don't initiate the redirect
      // from the client so instead, we'll simply send back the bare minimum of
      // safe parameters.
      var body = pick(atlasRes, 'showPasswordPage', 'eqp');
      res.status(200).json(body).end();
    })
    .catch(function(reason) {
      switch (reason.statusCode) {
      case 400:
        // invalid email address
        res.status(400).send(reason.body).end();
        break;
      default:
        console.error(reason, reason.stack);
        res.status(502).send(pick(reason, 'statusCode', 'body')).end();
      }
    });
});

router.post('/activate', function(req, res) {
  // TODO sanitize req.body instead of simply forwarding it on to Atlas
  spark.user.activate(req.body)
    .then(function() {
      res.status(204).end();
    })
    .catch(function(atlasRes) {
      console.error(atlasRes);
      res.status(502).send(pick(atlasRes, 'statusCode', 'body')).end();
    });
});

router.post('/reverify', function(req, res) {
  // TODO sanitize req.body instead of simply forwarding it onto Atlas
  spark.user.reverify(req.body)
    .then(function(atlasRes) {
      console.log(atlasRes);
    })
    .catch(function(atlasRes) {
      console.error(atlasRes);
      res.status(502).send(pick(atlasRes, 'statusCode', 'body')).end();
    });
});

module.exports = router;
