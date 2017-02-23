/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var extendError = require('extend-error');
var HttpError = require('./http-error');
var isArray = require('lodash.isArray');
var pick = require('lodash.pick');
var values = require('lodash.values');

var SparkHttpError = extendError(HttpError, {
  parseFn: function parseFn(res) {
    /* eslint complexity: [0] */
    var message = HttpError.prototype.parseFn.apply(this, arguments);

    var body = res.body;
    var rawMessage;
    switch (typeof body) {
      case 'string':
        try {
          body = JSON.parse(body);
          rawMessage = parseDescription(body);
        }
        catch (error) {
          rawMessage = body;
        }
        break;
      case 'object':
        rawMessage = parseDescription(body);
        break;
      default:
      // does nothing
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
  // Search body for common names of error strings
  var messages = values(pick(body, 'message', 'error', 'Errors', 'errorString', 'response', 'errorResponse', 'msg', 'description'));
  // If no error candidate was found, stringify the entire body
  if (messages.length === 0) {
    return JSON.stringify(body);
  }

  // Assume the first key found was the error explanation
  var message = messages[0];
  // if explanation is an array, recurse and try again with first element
  if (isArray(message) && message.length) {
    return parseDescription(message[0]);
  }

  // If the explanation is an object, recurse and try again
  if (typeof message === 'object') {
    return parseDescription(message);
  }
  // Return the first key
  return message;
}

module.exports = SparkHttpError;
