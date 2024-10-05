/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assign, curry, defaults as lodashDefaults, isString} from 'lodash';

import HttpStatusInterceptor from './interceptors/http-status';
import _request from './request';
import {prepareFetchOptions as _prepareFetchOptions} from './request/utils';

// Curry protorequest so we generate a function with default options built in.
const protorequest = curry(function protorequest(defaultOptions, options) {
  // allow for options to be a string (and therefore expect options in the third
  // position) to match request's api.
  if (isString(options)) {
    const uri = options;

    /* eslint prefer-rest-params: [0] */
    options = arguments[2] || {};
    options.uri = uri;
  }

  // Hide useless elements from logs
  ['download', 'interceptors', 'logger', 'upload'].forEach((prop) => {
    let descriptor = Reflect.getOwnPropertyDescriptor(options, prop);

    descriptor = assign({}, descriptor, {
      enumerable: false,
      writable: true,
    });
    Reflect.defineProperty(options, prop, descriptor);
  });

  lodashDefaults(options, defaultOptions);

  if (!options.json && options.json !== false) {
    Reflect.deleteProperty(options, 'json');
  }

  options.logger = options.logger || this.logger || console;

  return _request(options);
});

export const protoprepareFetchOptions = curry(function protoprepareFetchOptions(
  defaultOptions,
  options
) {
  // Hide useless elements from logs
  ['download', 'interceptors', 'logger', 'upload'].forEach((prop) => {
    let descriptor = Reflect.getOwnPropertyDescriptor(options, prop);

    descriptor = assign({}, descriptor, {
      enumerable: false,
      writable: true,
    });
    Reflect.defineProperty(options, prop, descriptor);
  });

  lodashDefaults(options, defaultOptions);

  options.logger = options.logger || this.logger || console;

  return _prepareFetchOptions(options);
});

/**
 * Sets the $timings value(s) before the request/fetch.
 * This function is only useful if you are about to send a request
 * using prepared fetch options; normally it is done in webex.request();
 *
 * @param {any} options
 * @returns {any} the updated options object
 */
const setRequestTimings = (options) => {
  const now = new Date().getTime();
  options.$timings = options.$timings || {};
  options.$timings.requestStart = now;
  options.$timings.networkStart = now;

  return options;
};

/**
 * Submits a metric from pre-built request options via the fetch API. Updates
 * the "$timings" values to Date.now() since the existing times were set when
 * the options were built (not submitted).
 *
 * @param {any} options - the pre-built request options for submitting a metric
 * @returns {Promise} promise that resolves to a response object
 */
export const setTimingsAndFetch = (options) => {
  const opts = setRequestTimings(options);

  // call the fetch API
  return fetch(opts.uri, opts);
};

const defaultOptions = {
  json: true,
  interceptors: [
    // Reminder: this is supposed to be an instantiated interceptor.
    HttpStatusInterceptor.create(),
  ],
};

export const defaults = protorequest;
export const request = protorequest(defaultOptions);
export {default as ProgressEvent} from './progress-event';
export {default as Interceptor} from './lib/interceptor';
export {default as HttpError} from './http-error';
export {default as HttpStatusInterceptor} from './interceptors/http-status';
export {default as detect} from './lib/detect';
