/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser} from '@webex/common';
import {Interceptor} from '@webex/http-core';
import {get} from 'lodash';

const strings = new WeakMap();

/**
 * @class
 */
export default class WebexUserAgentInterceptor extends Interceptor {
  /**
   * @param {Object} [options={}]
   * @param {WebexCore} [options.webex]
   * @private
   * @returns {WebexUserAgentInterceptor}
   */
  constructor(options = {}) {
    const libName = get(options, 'webex.webex', false) ? 'webex' : 'webex-js-sdk';
    const libVersion = get(options, 'webex.version', 'development');

    super(options);
    strings.set(this, `${libName}/${libVersion} (${inBrowser ? 'web' : 'node'})`);
  }

  /**
   * @returns {WebexUserAgentInterceptor}
   */
  static create() {
    return new WebexUserAgentInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    options.headers = options.headers || {};
    const {
      appName,
      appVersion,
      appPlatform
    } = this.webex?.config ?? {};
    let sparkUserAgent = `${strings.get(this)}`;

    if (appName) {
      sparkUserAgent += ` ${appName}/${appVersion ?? '0.0'}`;
    }

    if (appPlatform) {
      sparkUserAgent += ` ${appPlatform}`;
    }

    if (options.uri && options.uri.includes('https://idbroker')) {
      return options;
    }

    if (
      options.uri &&
      (
        options.uri.includes(this.webex.config.credentials.samlUrl) ||
        options.uri.includes(this.webex.config.credentials.tokenUrl) ||
        options.uri.includes(this.webex.config.credentials.authorizeUrl)
      )
    ) {
      return options;
    }

    if ('spark-user-agent' in options.headers) {
      if (!options.headers['spark-user-agent']) {
        Reflect.deleteProperty(options.headers, 'spark-user-agent');
      }

      return options;
    }

    options.headers['spark-user-agent'] = sparkUserAgent;

    return options;
  }
}
