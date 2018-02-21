/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@ciscospark/http-core';

const pattern = /(?:^\/)|(?:\/$)/;

/**
 * @class
 */
export default class UrlInterceptor extends Interceptor {
  /**
   * @returns {UrlInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new UrlInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (!options.uri) {
      this.checkOptions(options);
      this.normalizeOptions(options);

      return this.spark.internal.device.getServiceUrl(options.service)
        .then((uri) => {
          if (!uri) {
            return Promise.reject(new Error(`\`${options.service}\` is not a known service`));
          }

          // strip leading and trailing slashes before assembling the full uri
          if (options.resource) {
            uri = `${uri.replace(pattern, '')}/${options.resource.replace(pattern, '')}`;
          }

          options.uri = uri;
          return options;
        });
    }

    return options;
  }

  /**
   * Verify that all required parameters have been specified.
   * @param {Object} options
   * @returns {Object}
   */
  checkOptions(options) {
    if (!options.api && !options.service) {
      throw new Error('A `service` or `uri` parameter is required');
    }

    if (!options.resource) {
      throw new Error('A `resource` parameter is required');
    }
  }

  /**
   * accept api or service and rename to service
   * @param {Object} options
   * @private
   * @returns {Object}
   */
  normalizeOptions(options) {
    if (options.service) {
      return;
    }

    Object.assign(options, {
      service: options.service || options.api
    });

    Reflect.deleteProperty(options, 'api');
  }
}
