/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * This interceptor replaces the host in the request uri with the host from the hostmap
 * It will attempt to do this for every request, but not all URIs will be in the hostmap
 * URIs with hosts that are not in the hostmap will be left unchanged
 */
export default class HostMapInterceptor extends Interceptor {
  /**
   * @returns {HostMapInterceptor}
   */
  static create() {
    return new HostMapInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (options.uri) {
      try {
        options.uri = this.webex.internal.services.replaceHostFromHostmap(options.uri);
      } catch (error) {
        /* empty */
      }
    }

    return options;
  }
}
