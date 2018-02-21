/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import _request from './request';
import {inBrowser} from '@ciscospark/common';
import {EventEmitter} from 'events';

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
  if (!inBrowser && !options.headers['user-agent']) {
    options.headers['user-agent'] = '@ciscospark/http-core';
  }


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
        if (interceptor[successKey]) {
          return interceptor[successKey](options, result);
        }
        return Promise.resolve(result);
      },
      (reason) => {
        if (interceptor[errorKey]) {
          return interceptor[errorKey](options, reason);
        }
        return Promise.reject(reason);
      }
    ), Promise.resolve(res));
  }
}
