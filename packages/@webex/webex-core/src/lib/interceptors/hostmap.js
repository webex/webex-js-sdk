/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * This interceptor replaces the host in the request uri with the host from the hostmap
 * It will attempt to do this for every request, but not all URIs will be in the hostmap
 * URIs with hosts that are not in the hostmap will be left unchanged
 * Set `options.skipHostMap` to keep the original host (for example when a caller
 * has already chosen a specific catalog or service-link hostname).
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
    if (options.uri && !options.skipHostMap) {
      try {
        options.uri = this.webex.internal.services.replaceHostFromHostmap(options.uri);
      } catch (error) {
        /* empty */
      }
    }

    return options;
  }
}
