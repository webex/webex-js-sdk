/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {wrap} from 'lodash';
import make from '../template-container';

// Alias Map and WeakMap to get around a babel compiler bug
const W = WeakMap;
const M = Map;
const WeakMappedMappedMap = make(W, M, M);

const flights = new (WeakMappedMappedMap as any)();

export interface OneFlightOptions {
  keyFactory?: (...args: any[]) => string;
  cacheFailures?: boolean;
  cacheSuccesses?: boolean;
}

/**
 * Modern TypeScript decorator for one-flight pattern
 * Ensures that a method can only have one execution in flight at a time
 *
 * @param options Configuration options for the decorator
 * @returns Method decorator
 */
export function oneFlight(options?: OneFlightOptions): MethodDecorator;
export function oneFlight(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
): PropertyDescriptor;
export function oneFlight(
  targetOrOptions?: any | OneFlightOptions,
  propertyKey?: string | symbol,
  descriptor?: PropertyDescriptor
): MethodDecorator | PropertyDescriptor {
  // Handle usage as @oneFlight() with options
  if (
    arguments.length === 1 &&
    typeof targetOrOptions === 'object' &&
    !propertyKey &&
    !descriptor
  ) {
    const options = targetOrOptions as OneFlightOptions;

    return oneFlightDecorator(options);
  }

  // Handle usage as @oneFlight without parentheses
  if (arguments.length === 3) {
    return oneFlightDecorator({})(targetOrOptions, propertyKey!, descriptor!);
  }

  // Handle usage as @oneFlight() without options
  return oneFlightDecorator({});
}

function oneFlightDecorator(options: OneFlightOptions = {}) {
  const {cacheFailures, cacheSuccesses, keyFactory} = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const key = String(propertyKey);

    // Ensure we have a valid descriptor with a value
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@oneFlight can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }

    const originalMethod = descriptor.value;

    descriptor.value = wrap(
      originalMethod,
      function oneFlightExecutor(fn: (...args: any[]) => any, ...args: any[]) {
        let innerKey = key;

        if (keyFactory) {
          innerKey = `${innerKey}_${keyFactory(...args)}`;
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        let flight = flights.get(self, target, innerKey);

        if (flight) {
          return flight;
        }

        flight = Reflect.apply(fn, self, args);

        if (!cacheFailures && flight && typeof flight.catch === 'function') {
          flight = flight.catch((reason: any) => {
            flights.delete(self, target, innerKey);

            return Promise.reject(reason);
          });
        }

        if (!cacheSuccesses && flight && typeof flight.then === 'function') {
          flight = flight.then((result: any) => {
            flights.delete(self, target, innerKey);

            return result;
          });
        }

        flights.set(self, target, innerKey, flight);

        return flight;
      }
    );

    // This maintains compatibility with legacy usage patterns
    if (typeof target === 'object' && !target.prototype) {
      target[propertyKey] = descriptor.value;
    }

    return descriptor;
  };
}

// Legacy export for backward compatibility
export default oneFlight;
