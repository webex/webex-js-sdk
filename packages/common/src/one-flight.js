/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {isFunction} from 'lodash';

/**
 * @memberof Util
 * @param {string}   name
 * @param {Function} fn
 * @param {Object}   options
 * @returns {Function}
 */
export default function oneFlight(name, fn, options) {
  if (!name) {
    throw new Error(`\`name\` is required`);
  }

  if (!fn) {
    throw new Error(`\`fn\` is required`);
  }

  options = options || {};

  return function oneFlightExecutor(...args) {
    /* eslint no-invalid-this: [0] */
    let promiseName;
    if (isFunction(name)) {
      promiseName = `$promise${Reflect.apply(name, this, args)}`;
    }
    else {
      promiseName = `$promise${name}`;
    }

    if (this[promiseName]) {
      const message = `one flight: attempted to invoke ${name} while previous invocation still in flight`;

      /* instanbul ignore else */
      if (this && this.logger) {
        this.logger.info(message);
      }
      else {
        /* eslint no-console: [0] */
        console.info(message);
      }
      return this[promiseName];
    }

    const promise = this[promiseName] = Reflect.apply(fn, this, args);

    if (!options.cacheFailure && promise && promise.catch) {
      promise.catch(() => {
        this[promiseName] = null;
      });
    }

    if (!options.cacheSuccess && promise && promise.catch) {
      promise.then(() => {
        this[promiseName] = null;
      });
    }

    return promise;
  };
}
