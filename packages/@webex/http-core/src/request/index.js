/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';

import _request from './request';
import {intercept} from './utils';

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

  return intercept(options, options.interceptors, 'Request')
    .then((...args) => {
      // if provided own request function, use that instead
      // there are use cases where developer may want to provide whatever request promise they wish
      // for example, may even use window.postMessages for parent iframe uses cases
      if (options.request) {
        return options.request(options, ...args);
      }

      return _request(options, ...args);
    })
    .then((...args) => {
      return intercept(options, options.interceptors.slice().reverse(), 'Response', ...args);
    });
}
