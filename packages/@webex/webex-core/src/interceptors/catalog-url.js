/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * Validates that request URLs are in the service catalog.
 * Prevents SSRF attacks by blocking requests to unknown hosts.
 * @class
 */
export default class CatalogUrlInterceptor extends Interceptor {
  /**
   * @returns {CatalogUrlInterceptor}
   */
  static create() {
    return new CatalogUrlInterceptor({webex: this});
  }

  /**
   * @see {@link Interceptor#onRequest}
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    // Skip validation if using service parameter (already safe - resolved from catalog)
    if (options.service) {
      return Promise.resolve(options);
    }

    // Skip if explicitly opted out
    if (options.allowNonCatalogUrl === true) {
      return Promise.resolve(options);
    }

    const url = options.uri || options.url;

    // No URL to validate
    if (!url) {
      return Promise.resolve(options);
    }

    // Check if services plugin is available
    if (!this.webex.internal?.services) {
      // Services not loaded yet - allow but log
      this.webex.logger?.warn?.(`catalog-url: Cannot validate URL (services not loaded): ${url}`);

      return Promise.resolve(options);
    }

    // Check if URL is in service catalog
    const service = this.webex.internal.services.getServiceFromUrl(url);

    if (service) {
      // URL is in catalog - allow
      return Promise.resolve(options);
    }

    // URL not in catalog - block the request
    return Promise.reject(
      new Error(
        `Request blocked: URL not in service catalog: ${url}. ` +
          'Use {allowNonCatalogUrl: true} to bypass validation.'
      )
    );
  }
}
