/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

import {getHttpRetryDelay, resolveHttpRetryPolicy, willRetryHttpRequest} from './policy';

const getAbortError = (signal) => {
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }

  const error = new Error('The HTTP retry was aborted');

  error.name = 'AbortError';

  return error;
};

const wait = (delay, signal) => {
  if (signal?.aborted) {
    return Promise.reject(getAbortError(signal));
  }

  return new Promise((resolve, reject) => {
    let timeout;
    const onAbort = () => {
      clearTimeout(timeout);
      reject(getAbortError(signal));
    };

    timeout = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, delay);

    signal?.addEventListener?.('abort', onAbort, {once: true});
  });
};

/**
 * Replays eligible transient HTTP failures using the resolved request policy.
 */
export default class HttpRetryInterceptor extends Interceptor {
  /**
   * @returns {HttpRetryInterceptor}
   */
  static create() {
    return new HttpRetryInterceptor({webex: this});
  }

  /**
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  onRequest(options) {
    options.$httpRetryPolicy = this.resolvePolicy(options);
    options.$httpRetryWillRetry = (reason) =>
      willRetryHttpRequest({
        options,
        policy: options.$httpRetryPolicy,
        reason,
      });

    return Promise.resolve(options);
  }

  /**
   * @param {Object} options
   * @param {Error} reason
   * @returns {Promise}
   */
  onResponseError(options, reason) {
    const policy = options.$httpRetryPolicy || this.resolvePolicy(options);
    const delay = getHttpRetryDelay({policy, options, reason});

    if (delay === undefined) {
      return Promise.reject(reason);
    }

    return wait(delay, options.signal).then(() => {
      options.$httpRetryCount = (Number(options.$httpRetryCount) || 0) + 1;

      return this.webex.request(options);
    });
  }

  /**
   * @param {Object} options
   * @returns {Object}
   */
  resolvePolicy(options = {}) {
    return resolveHttpRetryPolicy({
      config: this.webex.config?.httpRetry,
      requestPolicy: options.httpRetry,
      serviceName: this.getServiceName(options),
      skipRetries: options.skipRetries,
      uri: options.uri || options.url || options.resource,
    });
  }

  /**
   * @param {Object} options
   * @returns {string|undefined}
   */
  getServiceName(options) {
    const explicitService = options.service || options.api;

    if (typeof explicitService === 'string') {
      return explicitService.toLowerCase();
    }

    const uri = options.uri || options.url;
    const services = this.webex.internal?.services;

    if (!uri || typeof services?.getServiceFromUrl !== 'function') {
      return undefined;
    }

    return services.getServiceFromUrl(uri)?.name?.toLowerCase();
  }
}
