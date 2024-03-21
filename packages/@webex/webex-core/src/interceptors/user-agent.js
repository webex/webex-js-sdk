/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser} from '@webex/common';
import {Interceptor} from '@webex/http-core';
import {get} from 'lodash';

const strings = new WeakMap();

/**
 * Sets a 'user-agent' header on all requests if one is not present.
 * Defaults to '@webex/http-core' though a custom user-agent can be set
 * using the appName and appVersion configuration. e.g.
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
 *       appName: 'custom-user-agent',
 *       appVersion: '1.0',
 *     }
 *   });
 */
export default class UserAgentInterceptor extends Interceptor {
  /**
   * @param {Object} [options={}]
   * @param {WebexCore} [options.webex]
   * @private
   * @returns {UserAgentInterceptor}
   */
  constructor(options = {}) {
    const appName = get(options, 'webex.config.appName');
    const appVersion = get(options, 'webex.config.appVersion') || '0.0';

    super(options);
    if (appName) {
      strings.set(this, `${appName}/${appVersion}`);
    } else {
      strings.set(this, '@webex/http-core'); // Using the traditional default from http-core
    }
  }

  /**
   * @returns {UserAgentInterceptor}
   */
  static create() {
    return new UserAgentInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    // Do not set a custom user-agent for browsers
    if (inBrowser) {
      return options;
    }

    options.headers = options.headers || {};

    if ('user-agent' in options.headers && options.headers['spark-user-agent']) {
      return options;
    }

    options.headers['user-agent'] = strings.get(this);

    return options;
  }
}
