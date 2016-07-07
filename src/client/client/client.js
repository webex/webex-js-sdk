/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var ClientBase = require('./client-base');
var isNumber = require('lodash.isnumber');
var request = require('request');

function ProgressEvent(loaded, total) {
  Object.defineProperties(this, {
    loaded: {
      enumerable: true,
      value: loaded,
      writable: false
    },
    total: {
      enumerable: true,
      value: total,
      writable: false
    },
    lengthComputable: {
      enumerable: true,
      value: isNumber(total) && !isNaN(total),
      writable: false
    }
  });
}

var Client = ClientBase.extend({
  _request: function _request(options) {
    return new Promise(function executor(resolve) {
      if (options.responseType === 'buffer' || options.responseType === 'blob') {
        options.encoding = null;
      }

      var r = request(options, function requestCallback(error, response) {
        if (error) {
          this.logger.warn(error);
        }

        if (response) {
          response.options = options;
          resolve(response);
        }
        else {
          resolve({
            statusCode: 0,
            options: options,
            headers: options.headers,
            method: options.method,
            url: options.uri,
            body: error
          });
        }
      }.bind(this));

      r.on('response', function onResponse(response) {
        var total = parseInt(response.headers['content-length']);
        var loaded = 0;
        response.on('data', function onData(data) {
          loaded += data.length;
          options.download.emit('progress', new ProgressEvent(loaded, total));
        });
      });
    }.bind(this));
  }
});

module.exports = Client;
