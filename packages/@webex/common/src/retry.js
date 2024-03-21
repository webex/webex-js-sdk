/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';

import {defaults, isFunction, wrap} from 'lodash';
import backoff from 'backoff';

/* eslint max-nested-callbacks: [0] */

/**
 * Makes a promise-returning method retryable according to the specified backoff
 * pattern
 * @param {Object} options
 * @param {boolean} options.backoff
 * @param {number} options.delay
 * @param {number} options.initialDelay
 * @param {number} options.maxAttempts
 * @param {number} options.maxDelay
 *
 * @returns {Function}
 */
export default function retry(...params) {
  let options = params[0] || {};

  options = {...options};
  defaults(options, {
    backoff: true,
    delay: 1,
    maxAttempts: 3,
  });

  let strategyOptions;

  if (options.backoff) {
    strategyOptions = {
      initialDelay: options.delay,
      maxDelay: options.maxDelay,
    };
  } else {
    strategyOptions = {
      initialDelay: 1,
      maxDelay: 1,
    };
  }

  if (params.length === 3) {
    return Reflect.apply(retryDecorator, null, params);
  }

  return retryDecorator;

  /**
   * @param {Object} target
   * @param {string} prop
   * @param {Object} descriptor
   * @private
   * @returns {Object}
   */
  function retryDecorator(target, prop, descriptor) {
    descriptor.value = wrap(descriptor.value, function retryExecutor(fn, ...args) {
      const emitter = new EventEmitter();
      const promise = new Promise((resolve, reject) => {
        // backoff.call is not Function.prototype.call; it's an unfortunate naming
        // collision.
        /* eslint prefer-reflect: [0] */
        const call = backoff.call(
          (cb) => {
            /* eslint no-invalid-this: [0] */
            const innerPromise = Reflect.apply(fn, this, args);

            if (isFunction(innerPromise.on)) {
              innerPromise.on('progress', emitter.emit.bind(emitter, 'progress'));
              innerPromise.on('upload-progress', emitter.emit.bind(emitter, 'upload-progress'));
              innerPromise.on('download-progress', emitter.emit.bind(emitter, 'download-progress'));
            }

            return innerPromise
              .then((res) => {
                cb(null, res);
              })
              .catch((reason) => {
                if (!reason) {
                  reason = new Error('retryable method failed without providing an error object');
                }
                cb(reason);
              });
          },
          (err, res) => {
            if (err) {
              return reject(err);
            }

            return resolve(res);
          }
        );

        call.setStrategy(new backoff.ExponentialStrategy(strategyOptions));
        if (options.maxAttempts) {
          call.failAfter(options.maxAttempts - 1);
        }

        call.start();
      });

      promise.on = function on(key, callback) {
        emitter.on(key, callback);

        return promise;
      };

      return promise;
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === 'object' && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  }
}
