/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var backoff = require('backoff');
var defaults = require('lodash.defaults');
var EventEmitter = require('events').EventEmitter;

/**
 * @memberof Util
 * @param {Function} fn
 * @param {Object}   options
 * @return {Function}
 */
function makeRetryable(fn, options) {
  if (!(fn instanceof Function)) {
    throw new Error('`fn` must be a function');
  }

  options = options || {};

  defaults(options, {
    backoff: true,
    delay: 1,
    maxAttempts: 3
  });

  var strategyOptions;
  if (!options.backoff) {
    strategyOptions = {
      initialDelay: 1,
      maxDelay: 1
    };
  }
  else {
    strategyOptions = {
      initialDelay: options.delay,
      maxDelay: options.maxDelay
    };
  }

  return function retryFn() {
    var self = this;
    var args = arguments;
    var emitter = new EventEmitter();

    var promise = new Promise(function executor(resolve, reject) {

      var call = backoff.call(apply, onComplete);
      call.setStrategy(new backoff.ExponentialStrategy(strategyOptions));
      if (options.maxAttempts) {
        call.failAfter(options.maxAttempts - 1);
      }

      call.start();

      function apply(cb) {
        var promise = fn.apply(self, args);

        if (promise.on) {
          promise.on('progress', emitter.emit.bind(emitter, 'progress'));
          promise.on('upload-progress', emitter.emit.bind(emitter, 'upload-progress'));
          promise.on('download-progress', emitter.emit.bind(emitter, 'download-progress'));
        }

        return promise
          .then(function onSuccess(res) {
            cb(null, res);
          })
          .catch(function onFailure(err) {
            if (!err) {
              err = new Error('retryable method failed without providing an error object');
            }
            cb(err);
          });
      }

      function onComplete(err, res) {
        if (err) {
          reject(err);
        }
        else {
          resolve(res);
        }
      }
    });

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    return promise;
  };
}

module.exports = makeRetryable;
