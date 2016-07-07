/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var extendError = require('extend-error');
var HttpError = require('./http-error');

var SparkHttpError = extendError(HttpError, {
  parseFn: function parseFn(res) {
    var message = HttpError.prototype.parseFn.apply(this, arguments);

    Object.defineProperty(this, 'options', {
      enumerable: false,
      value: res.options
    });

    message += '\n' + this.options.method + ' ' + this.options.url;
    message += '\nWEBEX_TRACKING_ID: ' + this.options.headers.TrackingID;

    return message;
  },
  subTypeName: 'SparkHttpError'
});

module.exports = SparkHttpError;
