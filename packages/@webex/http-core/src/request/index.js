/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';

import {isBuffer} from '@webex/common';

import detect from '../lib/detect';

function _request(options) {
  return prepareOptions(options)
    .then((options) => {
      const param = {
        method: options.method,
        headers: options.headers
      };

      // some request like region lookup does not have method
      if (options.method !== 'GET' && options.method) {
        param.body = param.form || JSON.stringify(options.body || {});
      }

      // Only set the content type for json
      // eg: application/x-www-form-urlencoded
      if (options.json && !options.form) {
        options.headers['Content-Type'] = 'application/json';
      }
      else if (options.form) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        param.body = new URLSearchParams(options.form);
      }

      const queryString = new URLSearchParams(options.qs).toString();

      console.log(`REQUEST OBJECT ${options.uri}\n ${param}`);

      return fetch(queryString ? `${options.uri}?${queryString}` : options.uri, param)
        .then(async (response) => {
          console.log('RESPONSE ', response);
          const body = await response.json();
          const result = {
            body,
            statusCode: response.status,
            method: options.method,
            headers: response.headers,
            url: response.url,
            rawRequest: response.rawRequest,
            options
          };

          return result;
        });
    });
}


/**
 * @param {Object} options
 * @private
 * @returns {Promise}
 */
function prepareOptions(options) {
  if (options.responseType === 'buffer' || options.responseType === 'blob') {
    options.encoding = null;
  }

  if (options.withCredentials) {
    options.jar = true;
  }

  if (isBuffer(options.body)) {
    const type = detect(options.body);

    options.headers['content-type'] = type;

    return options;
  }

  return Promise.resolve(options);
}
/**
 * @param {Object} options
 * @returns {Promise}
 */
export default function request(options) {
  if (options.url) {
    options.uri = options.url;
    options.url = null;
  }

  options.headers = options.headers || {};

  options.download = new EventEmitter();
  options.upload = new EventEmitter();

  return intercept(options.interceptors, 'Request')
    .then((...args) => _request(options, ...args))
    .then((...args) => intercept(options.interceptors.slice().reverse(), 'Response', ...args));

  /**
   * @param {Array} interceptors
   * @param {string} key
   * @param {Object} res
   * @private
   * @returns {Promise}
   */
  function intercept(interceptors, key, res) {
    const successKey = `on${key}`;
    const errorKey = `on${key}Error`;

    return interceptors.reduce((promise, interceptor) => promise.then(
      (result) => {
        interceptor.logOptions(options);
        if (interceptor[successKey]) {
          return interceptor[successKey](options, result);
        }

        return Promise.resolve(result);
      },
      (reason) => {
        interceptor.logOptions(options);
        if (interceptor[errorKey]) {
          return interceptor[errorKey](options, reason);
        }

        return Promise.reject(reason);
      }
    ), Promise.resolve(res));
  }
}
