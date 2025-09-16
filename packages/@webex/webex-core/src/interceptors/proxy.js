/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser} from '@webex/common';
import {Interceptor} from '@webex/http-core';
import {get} from 'lodash';

const strings = new WeakMap();

/**
 * Sets a proxy on all requests if one is not present.
 * Defaults to none, though a custom proxy can be set
 * using the proxy configuration. e.g.
 *
 *   webex = WebexSdk.init({
 *     credentials: {
 *       supertoken: superToken
 *     },
 *     config: {
 *       credentials: {
 *         client_id,
 *         client_secret
 *       },
 *       proxy: 'http://myproxy.company.com'
 *     }
 *   });
 */
export default class ProxyInterceptor extends Interceptor {
  /**
   * @param {Object} [options={}]
   * @param {WebexCore} [options.webex]
   * @private
   * @returns {ProxyInterceptor}
   */
  constructor(options = {}) {
    const proxy = get(options, 'webex.config.proxy');

    super(options);
    if (proxy) {
      strings.set(this, proxy);
    }
  }

  /**
   * @returns {ProxyInterceptor}
   */
  static create() {
    return new ProxyInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    // Do not set a proxy for browsers
    if (inBrowser) {
      return options;
    }

    const proxy = strings.get(this);
    if (proxy) {
      options.proxy = proxy;
    }

    return options;
  }
}
