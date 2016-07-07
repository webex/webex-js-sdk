/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-console:[0] */

'use strict';

var isArray = require('lodash.isarray');
var isString = require('lodash.isstring');
var omit = require('lodash.omit');

var testLoggerProcessor = {
  pre: function pre(options) {
    var trackingId = options.headers.TrackingID;
    console.log('**********************************************************************');
    console.log('WEBEX_TRACKINGID: ', trackingId);
    var xtid = options.headers['x-trans-id'];
    /* istanbul ignore next */
    if (xtid) {
      console.log('X-Trans-ID: ', xtid);
    }
    console.log('User ID: ', this.spark.device.userId);
    console.log('Request URL: ', options.uri);
    var now = options.__start = new Date();
    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      console.log('ISO Date: ', now.toISOString());
      console.log('Timestamp: ', now.getTime());

      try {
        // Determine if body is a buffer without relying on Buffer to avoid
        // node/browser conflicts.
        if (options.body && options.body.length && !isArray(options.body) && !isString(options.body)) {
          console.log('Request Options:', JSON.stringify(omit(options, 'body'), null, 2));
        }
        else {
          console.log('Request Options:', JSON.stringify(options, null, 2));
        }
      }
      catch (e) {
        console.log('Could not stringify request options:', e);
      }
    }

    return options;
  },
  post: {
    onResolve: function onResolve(res) {
      var now = new Date();
      var options = res.options;
      var trackingId = options.headers.TrackingID;
      console.log('WEBEX_TRACKINGID: ', trackingId);
      console.log('Request duration:', now - options.__start);

      if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
        console.log('Timestamp: ', now.getTime());

        if (typeof res.body === 'string' || Buffer.isBuffer(res.body)) {
          console.log('Response: ', 'Not printed, it\'s probably a file');
        }
        else if (typeof res.body === 'object') {
          try {
            console.log('Response: ', JSON.stringify(res.body, null, 2));
          }
          catch (err) {
            console.log('Response: ', '[Not Serializable]', err);
          }
        }
      }

      return res;
    },
    onReject: function onReject(res) {
      var now = Date.now();
      var trackingId = res.options.headers.TrackingID;
      console.error('WEBEX_TRACKINGID: ', trackingId);
      console.error('Status Code: ', res.statusCode);
      console.error('Request duration: ', now - res.options.__start);

      if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
        try {
          console.error('Response: ', JSON.stringify(res.body, null, 2));
        }
        catch (err) {
          console.error('Response: ', res.body);
        }
      }
      throw res;
    }
  }
};

module.exports = testLoggerProcessor;
