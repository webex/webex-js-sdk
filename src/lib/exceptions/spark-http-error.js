/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var extendError = require('extend-error');
var HttpError = require('./http-error');
var isArray = require('lodash.isArray');
var pick = require('lodash.pick');
var values = require('lodash.values');

var SparkHttpError = extendError(HttpError, {
  parseFn: function parseFn(res) {
    var message = HttpError.prototype.parseFn.apply(this, arguments);

    var rawMessage;
    try {
      rawMessage = JSON.parse(message);
      rawMessage = parseDescription(rawMessage);
    }
    catch (error) {
      rawMessage = message;
    }

    Object.defineProperties(this, {
      options: {
        enumerable: false,
        value: res.options
      },
      rawMessage: {
        enumerable: false,
        value: rawMessage || ''
      }
    });

    if (this.options.url) {
      message += '\n' + this.options.method + ' ' + this.options.url;
    }
    else if (this.options.uri) {
      message += '\n' + this.options.method + ' ' + this.options.uri;
    }
    else {
      var service = this.options.service || '';
      message += '\n' + this.options.method + ' ' + service + '/' + this.options.resource;
    }

    message += '\nWEBEX_TRACKING_ID: ' + this.options.headers.TrackingID;
    if (this.options.headers['x-trans-id']) {
      message += '\nX-Trans-Id: ' + this.options.headers['x-trans-id'];
    }

    return message;
  },
  subTypeName: 'SparkHttpError'
});

function parseDescription(body) {

  // if explanation is an array, recurse and try again with first element
  if (isArray(body) && body.length) {
    return parseDescription(body[0]);
  }

  // Search body for common names of error strings
  var messages = values(pick(body, 'description'));
  // If no error candidate was found, stringify the entire body
  if (messages.length === 0) {
    return JSON.stringify(body);
  }

  // Assume the first key found was the error explanation
  var message = messages[0];
  // If the explanation is an object, recurse and try again
  if (typeof message === 'object') {
    return parseDescription(message);
  }
  // Return the first key
  return message;
}

module.exports = SparkHttpError;
