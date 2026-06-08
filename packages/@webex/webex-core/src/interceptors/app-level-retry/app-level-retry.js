/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

import {
  getRetryDelay,
  normalizeMethod,
  resolveRetryPolicy,
  shouldApplyRetryPolicy,
  shouldRetry,
} from './utils';

const requestState = new WeakMap();
const retryState = new WeakMap();

const wait = (delay) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

const normalizeServiceName = (serviceName) =>
  typeof serviceName === 'string' ? serviceName.toLowerCase() : undefined;

const getCurrentTime = () => new Date().getTime();

/**
 * Handles app-configured retries for transient HTTP throttling/service errors.
 */
export default class AppLevelRetryInterceptor extends Interceptor {
  /**
   * @returns {AppLevelRetryInterceptor}
   */
  static create() {
    return new AppLevelRetryInterceptor({webex: this});
  }

  /**
   * constructor
   * @param {mixed} args
   * @returns {AppLevelRetryInterceptor}
   */
  constructor(...args) {
    super(...args);
    retryState.set(this, new Map());
  }

  /**
   * @see {@link Interceptor#onRequest}
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const metadata = this.getRequestMetadata(options);
    const policy = this.resolvePolicy(options, metadata);
    const state = this.getScopedRetryState(metadata.key);

    if (
      shouldApplyRetryPolicy({policy, method: metadata.method}) &&
      state &&
      state.replay &&
      getCurrentTime() < state.expiresAt
    ) {
      return Promise.reject(new Error(`API rate limited ${metadata.key}`));
    }

    return Promise.resolve(options);
  }

  /**
   * @see {@link Interceptor#onResponseError}
   * @param {Object} options
   * @param {Error} reason
   * @returns {Promise}
   */
  onResponseError(options, reason) {
    const metadata = this.getRequestMetadata(options);
    const policy = this.resolvePolicy(options, metadata);

    if (!shouldRetry({policy, reason, method: metadata.method})) {
      return Promise.reject(reason);
    }

    const state = this.getScopedRetryState(metadata.key);
    const retryCount = state ? state.retryCount : 0;
    const retryDelay = getRetryDelay({policy, reason, retryCount});

    if (retryDelay === undefined) {
      this.clearScopedRetryState(metadata.key);

      return Promise.reject(reason);
    }

    if (state && state.replay && getCurrentTime() < state.expiresAt) {
      this.setRetryExpiry(metadata.key, retryDelay, retryCount);

      return Promise.reject(reason);
    }

    return this.replayAfterDelay(options, metadata.key, retryDelay, retryCount + 1);
  }

  /**
   * @param {Object} options
   * @returns {Object}
   */
  getRequestMetadata(options = {}) {
    const state = requestState.get(options);

    if (state) {
      return state;
    }

    const service =
      normalizeServiceName(options.service || options.api) || this.getCatalogService(options);
    const uri = options.uri || options.url || '';
    const method = normalizeMethod(options.method);
    const key = service ? `service:${service}` : `uri:${uri}`;
    const metadata = {
      key,
      method,
      service,
      uri,
    };

    requestState.set(options, metadata);

    return metadata;
  }

  /**
   * @param {Object} options
   * @param {Object} metadata
   * @returns {Object}
   */
  resolvePolicy(options, metadata) {
    return resolveRetryPolicy({
      appLevelRetry: this.webex.config && this.webex.config.appLevelRetry,
      serviceName: metadata.service,
      requestRetryPolicy: options && options.retryPolicy,
    });
  }

  /**
   * @param {Object} options
   * @returns {string|undefined}
   */
  getCatalogService(options = {}) {
    const uri = options.uri || options.url;
    const services = this.webex.internal && this.webex.internal.services;

    if (!uri || !services || typeof services.getServiceFromUrl !== 'function') {
      return undefined;
    }

    const service = services.getServiceFromUrl(uri);

    return service && normalizeServiceName(service.name);
  }

  /**
   * @param {string} key
   * @returns {Object|undefined}
   */
  getScopedRetryState(key) {
    return retryState.get(this).get(key);
  }

  /**
   * @param {string} key
   * @param {number} retryDelay
   * @param {number} retryCount
   * @returns {Object}
   */
  setRetryExpiry(key, retryDelay, retryCount) {
    const state = this.getScopedRetryState(key) || {};
    const expiresAt = Math.max(state.expiresAt || 0, getCurrentTime() + retryDelay);
    const nextState = {
      ...state,
      expiresAt,
      retryCount,
    };

    retryState.get(this).set(key, nextState);

    return nextState;
  }

  /**
   * @param {string} key
   * @returns {void}
   */
  clearScopedRetryState(key) {
    retryState.get(this).delete(key);
  }

  /**
   * @param {string} key
   * @returns {Promise}
   */
  waitForRetry(key) {
    const state = this.getScopedRetryState(key);
    const delay = Math.max(((state && state.expiresAt) || 0) - getCurrentTime(), 0);

    if (!delay) {
      return Promise.resolve();
    }

    return wait(delay).then(() => this.waitForRetry(key));
  }

  /**
   * @param {Object} options
   * @param {string} key
   * @param {number} retryDelay
   * @param {number} retryCount
   * @returns {Promise}
   */
  replayAfterDelay(options, key, retryDelay, retryCount) {
    const state = this.setRetryExpiry(key, retryDelay, retryCount);

    state.replay = this.waitForRetry(key)
      .then(() => this.webex.request(options))
      .finally(() => {
        this.clearScopedRetryState(key);
      });

    return state.replay;
  }
}
