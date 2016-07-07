/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var isFunction = require('lodash.isfunction');

/**
 * @memberof Util
 * @param {string}   name
 * @param {Function} fn
 * @param {Object}   options
 * @return {Function}
 */
function oneFlight(name, fn, options) {
  if (!name) {
    throw new Error('`name` is required');
  }

  if (!fn) {
    throw new Error('`fn` is required');
  }

  options = options || {};

  return function oneFlightExecutor() {
    var promiseName;
    if (isFunction(name)) {
      promiseName = '$promise' + name.apply(this, arguments);
    }
    else {
      promiseName = '$promise' + name;
    }

    if (this[promiseName]) {
      var message = 'one flight: attempted to invoke ' + name + ' while previous invocation still in flight';

      /* instanbul ignore else */
      if (this && this.logger) {
        this.logger.debug(message);
      }
      else {
        /* eslint no-console: [0] */
        console.info(message);
      }
      return this[promiseName];
    }

    var promise = this[promiseName] = fn.apply(this, arguments);

    if (!options.cacheFailure && promise && promise.catch) {
      promise.catch(unset.bind(this));
    }

    if (!options.cacheSuccess && promise && promise.catch) {
      promise.then(unset.bind(this));
    }

    return promise;

    function unset() {
      this[promiseName] = null;
    }
  };
}

module.exports = oneFlight;
