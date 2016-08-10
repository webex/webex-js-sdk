/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {wrap} from 'lodash';

const flights = new Map();

/**
 * @memberof Util
 * @param {Object} options
 * @param {Function} options.keyFactory
 * @param {boolean} options.cacheFailures
 * @param {boolean} options.cacheSuccesses
 * @returns {Function}
 */
export default function oneFlight(...params) {
  if (params.length === 3) {
    return Reflect.apply(oneFlightDecorator, null, params);
  }

  const options = params[0] || {};

  const {
    cacheFailures,
    cacheSuccesses,
    keyFactory
  } = options;

  return oneFlightDecorator;

  function oneFlightDecorator(target, prop, descriptor) {
    let sym;
    if (!keyFactory) {
      sym = Symbol(prop);
    }

    descriptor.value = wrap(descriptor.value, function oneFlightExecutor(fn, ...args) {
      if (keyFactory) {
        sym = keyFactory(args);
      }

      /* eslint no-invalid-this: [0] */
      let flight = flights.get(sym);
      if (flight) {
        const message = `one flight: attempted to invoke ${prop} while previous invocation still in flight`;
        /* instanbul ignore else */
        if (this && this.logger) {
          this.logger.info(message);
        }
        else {
          /* eslint no-console: [0] */
          console.info(message);
        }
        return flight;
      }

      flight = Reflect.apply(fn, this, args);
      if (!cacheFailures && flight && flight.catch) {
        flight = flight.catch((reason) => {
          flights.delete(sym);
          return Promise.reject(reason);
        });
      }

      if (!cacheSuccesses && flight && flight.then) {
        flight = flight.then((result) => {
          flights.delete(sym);
          return result;
        });
      }

      flights.set(sym, flight);

      return flight;
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  }
}
