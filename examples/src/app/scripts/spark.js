/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */
/* eslint camelcase: [0] */
/* eslint no-alert: [0] */
'use strict';

// You'll want to use the commented-out line in your code
// Note: loading /src so that we can override the browserify transforms provided
// in package.json
var Spark = require('../../../../src');
// var Spark = require('spark-js-sdk');

// Load cached values
var credentials;
var device;
try {
  credentials = JSON.parse(localStorage.getItem('credentials'));
  if (credentials && credentials.refresh_token_expires < Date.now()) {
    credentials = undefined;
  }
  device = JSON.parse(localStorage.getItem('device'));
}
catch (error) {
  // ignore
}

// Initialize the SDK
var spark = window.spark = new Spark({
  credentials: credentials,
  device: device,
  config: {
    credentials: {
      oauth: {
        client_id: process.env.COMMON_IDENTITY_CLIENT_ID,
        client_secret: process.env.COMMON_IDENTITY_CLIENT_SECRET,
        redirect_uri: process.env.COMMON_IDENTITY_REDIRECT_URI,
        scope: 'webexsquare:get_conversation Identity:SCIM',
        service: 'spark'
      },
      loginPath: '/login',
      logoutPath: '/logout',
      refreshPath: '/refresh'
    },
    support: {
      appVersion: process.env.NODE_ENV,
      appType: 'example app',
      languageCode: 'en'
    },
    trackingIdPrefix: 'example'
  }
});

// Make sure we store any credentials or device configuration. Use
// listentoAndRun to guarantee that we write any values that may have been read
// from the url during construction.
spark.listenToAndRun(spark, 'change:device', function() {
  localStorage.setItem('device', JSON.stringify(spark.device));
});

spark.listenToAndRun(spark, 'change:credentials', function() {
  localStorage.setItem('credentials', JSON.stringify(spark.credentials));
});

module.exports = spark;
