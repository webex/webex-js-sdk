/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';


/**
 * Allows the user of the SDK to set default options that apply every http request made by the SDK
 * For example a default timeout could be set for all requests like this :
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
 *       defaultRequestOptions: {
 *         timeout: 15000
 *       }
 *     }
 *   });
 */
export default class DefaultOptionsInterceptor extends Interceptor {
  /**
   * @returns {DefaultOptionsInterceptor}
   */
  static create() {
    return new DefaultOptionsInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const {defaultRequestOptions: defaultOptions} = this.webex.config;

    if (!defaultOptions) {
      return options;
    }

    Object.keys(defaultOptions).forEach((key) => {
      // don't override any existing option properties
      if (!Object.keys(options).includes(key)) {
        options[key] = defaultOptions[key];
      }
    });

    return options;
  }
}
