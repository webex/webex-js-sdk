/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {wrap} from 'lodash';

/**
 * @memberof Util
 * @param {Object} options
 * @returns {Function}
 */
export default function oneFlight(options) {
  options = options || {};

  const {
    cacheFailures,
    cacheSuccesses
  } = options;

  return function decorate(target, prop, descriptor) {
    const sym = Symbol(prop);

    descriptor.value = wrap(descriptor.value, function executor(fn, ...args) {
      /* eslint no-invalid-this: [0] */
      if (this[sym]) {
        const message = `one flight: attempted to invoke ${prop} while previous invocation still in flight`;
        /* instanbul ignore else */
        if (this && this.logger) {
          this.logger.info(message);
        }
        else {
          /* eslint no-console: [0] */
          console.info(message);
        }
        return this[sym];
      }

      const promise = this[sym] = Reflect.apply(fn, this, args);
      if (!cacheFailures && promise && promise.catch) {
        promise.catch(() => {
          Reflect.deleteProperty(this, sym);
        });
      }

      if (!cacheSuccesses && promise && promise.then) {
        promise.then(() => {
          Reflect.deleteProperty(this, sym);
        });
      }

      return promise;
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  };
}
