/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {wrap} from 'lodash';

const instances = new WeakMap();

/**
 * @param {Object} instance
 * @param {string} key
 * @private
 * @returns {Promise}
 */
function getFlight(instance, key) {
  const flights = instances.get(instance);
  if (!flights) {
    return null;
  }

  const f = flights.get(key);
  return f;
}

/**
 * @param {Object} instance
 * @param {string} key
 * @param {Promise} flight
 * @private
 * @returns {undefined}
 */
function setFlight(instance, key, flight) {
  let flights = instances.get(instance);
  if (!flights) {
    flights = new Map();
    instances.set(instance, flights);
  }

  flights.set(key, flight);
}

/**
 * @param {Object} instance
 * @param {string} key
 * @private
 * @returns {undefined}
 */
function clearFlight(instance, key) {
  const flights = instances.get(instance);
  if (flights) {
    flights.delete(key);
    if (flights.size === 0) {
      instances.delete(instance);
    }
  }
}

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

  /**
   * @param {Object} target
   * @param {string} prop
   * @param {Object} descriptor
   * @private
   * @returns {Object}
   */
  function oneFlightDecorator(target, prop, descriptor) {
    let key = prop;
    descriptor.value = wrap(descriptor.value, function oneFlightExecutor(fn, ...args) {
      if (keyFactory) {
        key = keyFactory(args);
      }

      /* eslint no-invalid-this: [0] */
      let flight = getFlight(this, key);
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
          clearFlight(this, key);
          return Promise.reject(reason);
        });
      }

      if (!cacheSuccesses && flight && flight.then) {
        flight = flight.then((result) => {
          clearFlight(this, key);
          return result;
        });
      }

      setFlight(this, key, flight);

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
