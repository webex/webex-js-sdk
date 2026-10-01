/* eslint-disable prefer-destructuring */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {clone} from 'lodash';
import {Interceptor} from '@webex/http-core';

const requestHeaderName = 'cisco-no-http-redirect';
const responseHeaderName = 'cisco-location';
const LOCUS_REDIRECT_ERROR = 2000002;
const APPAPI_REDIRECT_ERROR = 404100;
// The status code both body based redirects are documented to arrive with, and
// the one `HttpStatusInterceptor` pairs each of the error codes above with.
const REDIRECT_ERROR_STATUS_CODE = 404;

/**
 * Copies the options of a request that is about to be re-issued against a uri
 * taken from the previous response.
 *
 * The copy drops any `authorization` header carried over from the previous
 * request. `AuthInterceptor` returns early when a request already carries that
 * header, so a carried-over header means the interceptor never evaluates the
 * new uri. Dropping it lets the interceptor make its normal decision against
 * the uri that is actually about to be requested.
 *
 * @param {Object} options - The options of the request being redirected.
 * @returns {Object} - A copy of the options, without inherited credentials.
 */
function cloneOptionsForRedirect(options) {
  const redirectOptions = clone(options);

  // `clone()` is shallow, so `headers` is still the previous request's object.
  if (redirectOptions.headers) {
    redirectOptions.headers = {...redirectOptions.headers};
    Reflect.deleteProperty(redirectOptions.headers, 'authorization');
  }

  return redirectOptions;
}

/**
 * @class
 */
export default class RedirectInterceptor extends Interceptor {
  /**
   * @returns {RedirectInterceptor}
   */
  static create() {
    return new RedirectInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    if (options && options.uri && typeof options.uri === 'string') {
      if (
        options.uri.includes('https://idbroker') ||
        options.uri.includes(this.webex.config.credentials.samlUrl) ||
        options.uri.includes(this.webex.config.credentials.tokenUrl) ||
        options.uri.includes(this.webex.config.credentials.authorizeUrl)
      ) {
        return options;
      }
    }

    // If cisco-no-http-redirect is already set, don't overwrite it
    if (requestHeaderName in options.headers) {
      // If cisco-no-http-redirect is set to null, false, or undefined, delete
      // it to prevent a CORS preflight.
      if (!options.headers[requestHeaderName]) {
        Reflect.deleteProperty(options.headers, requestHeaderName);
      }

      return options;
    }
    options.headers[requestHeaderName] = true;
    options.$redirectCount = options.$redirectCount || 0;

    return options;
  }

  /**
   * @see Interceptor#onResponse
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    /* eslint-disable no-else-return */
    if (response.headers && response.headers[responseHeaderName]) {
      options = cloneOptionsForRedirect(options);
      options.uri = response.headers[responseHeaderName];
      options.$redirectCount += 1;
      if (options.$redirectCount > this.webex.config.maxAppLevelRedirects) {
        return Promise.reject(new Error('Maximum redirects exceeded'));
      }

      return this.webex.request(options);
    } else if (
      response.statusCode === REDIRECT_ERROR_STATUS_CODE &&
      response.headers &&
      response.body &&
      response.body.errorCode === LOCUS_REDIRECT_ERROR &&
      response.body.location
    ) {
      options = cloneOptionsForRedirect(options);

      this.webex.logger.warn('redirect: url redirects needed from', options.uri);
      if (response.options && response.options.qs) {
        // for POST requests
        const newUrl = response.body.location.split('?');

        options.uri = newUrl[0]; // params are already present in the qs
      } else {
        // for GET requests
        options.uri = response.body.location;
      }

      this.webex.logger.warn('redirect: url redirects needed to', options.uri);
      options.$redirectCount += 1;
      if (options.$redirectCount > this.webex.config.maxLocusRedirects) {
        return Promise.reject(new Error('Maximum redirects exceeded'));
      }

      return this.webex.request(options);
    } else if (
      response.statusCode === REDIRECT_ERROR_STATUS_CODE &&
      response.headers &&
      response.body &&
      response.body.code === APPAPI_REDIRECT_ERROR &&
      response.body.data &&
      response.body.data.siteFullUrl
    ) {
      options = cloneOptionsForRedirect(options);

      this.webex.logger.warn('redirect: url redirects needed from', options.uri);
      if (response.options && response.options.qs) {
        // for POST requests
        const newUrl = response.body.data.siteFullUrl.split('?');

        options.uri = newUrl[0]; // params are already present in the qs
      } else {
        // for GET requests
        options.uri = options.uri.replace(
          /(https:\/\/)[^/]+/,
          `$1${response.body.data.siteFullUrl}`
        );
      }

      if (options.resource === 'preJoin' && options.service === 'webex-appapi-service') {
        options.headers.authorization = false;
      }

      this.webex.logger.warn('redirect: url redirects needed to', options.uri);
      options.$redirectCount += 1;
      if (options.$redirectCount > this.webex.config.maxLocusRedirects) {
        return Promise.reject(new Error('Maximum redirects exceeded'));
      }

      return this.webex.request(options);
    }
    /* eslint-enable no-else-return */

    return response;
  }
}
