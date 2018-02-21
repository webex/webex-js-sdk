/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser} from '@ciscospark/common';
import {Interceptor} from '@ciscospark/http-core';
import {get} from 'lodash';

const strings = new WeakMap();
/**
 * @class
 */
export default class SparkUserAgentInterceptor extends Interceptor {
  /**
   * @param {Object} [options={}]
   * @param {SparkCore} [options.spark]
   * @private
   * @returns {SparkUserAgentInterceptor}
   */
  constructor(options = {}) {
    const appName = get(options, 'spark.config.appName');
    const appVersion = get(options, 'spark.config.appVersion');

    const libName = get(options, 'spark.ciscospark', false) ? 'ciscospark' : 'spark-js-sdk';
    const libVersion = get(options, 'spark.version', 'development');

    super(options);
    if (appName && appVersion) {
      strings.set(this, `${appName}/${appVersion} (${inBrowser ? 'web' : 'node'}) ${libName}/${libVersion}`);
    }
    else {
      strings.set(this, `${libName}/${libVersion} (${inBrowser ? 'web' : 'node'})`);
    }
  }

  /**
   * @returns {SparkUserAgentInterceptor}
   */
  static create() {
    return new SparkUserAgentInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    options.headers = options.headers || {};

    if (options.uri && (options.uri.includes(this.spark.config.credentials.samlUrl) || options.uri.includes(this.spark.config.credentials.tokenUrl) || options.uri.includes(this.spark.config.credentials.authorizeUrl))) {
      return options;
    }

    if ('spark-user-agent' in options.headers) {
      if (!options.headers['spark-user-agent']) {
        Reflect.deleteProperty(options.headers, 'spark-user-agent');
      }
      return options;
    }

    options.headers['spark-user-agent'] = strings.get(this);

    return options;
  }
}
