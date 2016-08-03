/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assign, curry, defaults as lodashDefaults, isString} from 'lodash';
import HttpStatusInterceptor from './interceptors/http-status';
import _request from './request';

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
  [
    `download`,
    `interceptors`,
    `logger`,
    `upload`
  ].forEach((prop) => {
    let descriptor = Reflect.getOwnPropertyDescriptor(options, prop);
    descriptor = assign({}, descriptor, {
      enumerable: false,
      writable: true
    });
    Reflect.defineProperty(options, prop, descriptor);
  });

  lodashDefaults(options, defaultOptions);

  options.logger = options.logger || console;

  return _request(options);
});

const defaultOptions = {
  json: true,
  interceptors: [
    // Reminder: this is supposed to be an instantiated interceptor.
    HttpStatusInterceptor.create()
  ]
};

export const defaults = protorequest;
export const request = protorequest(defaultOptions);
export {default as ProgressEvent} from './progress-event';
export {default as Interceptor} from './lib/interceptor';
export {default as HttpError} from './http-error';
export {default as HttpStatusInterceptor} from './interceptors/http-status';
export {detect, detectSync} from './lib/detect';
