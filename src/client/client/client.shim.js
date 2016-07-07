/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var ClientBase = require('./client-base');
var contains = require('lodash.contains');
var pick = require('lodash.pick');
var querystring = require('querystring');
var xhr = require('xhr');

var Client = ClientBase.extend({
  requestDefaults: {
    json: true,
    cors: true,
    // raynos/xhr defaults withCredentials to true if cors is true, so we need
    // to make it explicitly false by default
    withCredentials: false,
    timeout: 0
  },

  _request: function _request(options) {
    // I don't usually believe in overriding the complexity value, but I don't
    // see any useful way to split the paths into smaller functions.
    /* eslint complexity: [0] */
    /* eslint max-statements: [0] */
    return new Promise(function executor(resolve) {

      var params = pick(options, 'method', 'uri', 'withCredentials', 'headers', 'timeout', 'responseType');

      // Set response to true to approximate an HttpResponse object
      params.response = true;

      if (!params.uri) {
        params.uri = options.url;
      }

      if (options.auth) {
        var type = options.auth.bearer ? 'Bearer' : 'Basic';
        var user = options.auth.user || options.auth.username;
        var pass = options.auth.pass || options.auth.password;
        var token = type + ' ' + btoa(user + ':' + pass);
        params.headers.Authorization = token;
      }

      if (options.responseType === 'buffer') {
        params.responseType = 'arraybuffer';
      }

      if ((!('json' in options) || options.json === true) && options.body) {
        params.json = options.body;
      }
      else if (options.form) {
        params.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        params.body = querystring.stringify(options.form);
        delete params.json;
      }
      else if (options.formData) {
        var fd = new FormData();
        for (var key in options.formData) {
          if (Object.hasOwnProperty.call(options.formData, key)) {
            fd.append(key, options.formData[key]);
          }
        }
        params.body = fd;
        delete params.json;
      }
      else {
        params.body = options.body;
        delete params.json;
      }

      if (options.qs) {
        params.uri += '?' + querystring.stringify(options.qs);
      }

      // If we have no JSON to send, send an empty object (to keep certain
      // browsers *cough* IE *cough* from breaking)
      if (options.json === true && !options.body && !options.form) {
        params.json = {};
      }

      // If this is a request that sends data, tnitialize an XMLHTTPRequest so
      // that we can attach the upload progress event before the open() call.
      if (params.method && contains(['PATCH', 'POST', 'PUT'], params.method.toUpperCase())) {
        params.xhr = new XMLHttpRequest();
        params.xhr.upload.onprogress = options.upload.emit.bind(options.upload, 'progress');
      }

      var x = xhr(params, function xhrCallback(error, response) {
        if (error) {
          this.logger.warn(error);
        }

        if (response) {
          // If params.json is not defined, xhr won't deserialize the response
          // so we should give it a shot just in case.
          if (!params.json && typeof response.body !== 'object') {
            try {
              response.body = JSON.parse(response.body);
            }
            catch (e) {
              /* eslint no-empty: [0] */
            }
          }

          // If we got an error, it means either CORS or network. Let's make the
          // reponse object as close to what we were expecting as possible
          if (error) {
            if (!response.url) {
              response.url = options.uri;
            }
            if (!response.method) {
              response.method = options.method;
            }
          }

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

      x.onprogress = options.download.emit.bind(options.download, 'progress');
    }.bind(this));
  }
});

module.exports = Client;
