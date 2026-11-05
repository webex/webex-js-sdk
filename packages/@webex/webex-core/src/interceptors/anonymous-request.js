/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

import {applyAnonymousRequestPolicy} from '../lib/anonymous-request';

/**
 * Enforce anonymous endpoint rules after defaults and destination rewrites.
 */
export default class AnonymousRequestInterceptor extends Interceptor {
  /**
   * @returns {AnonymousRequestInterceptor} Final request safeguard.
   */
  static create() {
    return new AnonymousRequestInterceptor({webex: this});
  }

  /**
   * @param {Object} options - Request options after the selected interceptors.
   * @returns {Object} Request options without prohibited authorization.
   */
  onRequest(options) {
    applyAnonymousRequestPolicy(options, this.webex.config?.services?.allowedWithoutAuthHeader);

    return options;
  }
}
