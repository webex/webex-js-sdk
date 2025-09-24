/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import 'reflect-metadata';
import {validateSync} from 'class-validator';

import {WebexConfigurable, WebexRequest, WebexResponse} from './transformable-classes';

/**
 * Modern Webex decorator for caching method results
 * Replaces the legacy one-flight pattern with class-transformer approach
 * @param {object} options - Configuration options for caching
 * @param {number} [options.ttl] - Time to live in milliseconds
 * @param {string} [options.key] - Custom cache key prefix
 * @returns {MethodDecorator} Method decorator function
 */
export function WebexCacheable(options: {ttl?: number; key?: string} = {}): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@WebexCacheable can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }
    const originalMethod = descriptor.value;
    const cacheKey = options.key || `${target.constructor.name}.${propertyKey}`;
    const cache = new Map<string, {value: any; expiry: number}>();

    descriptor.value = function (...args: any[]) {
      const key = `${cacheKey}:${JSON.stringify(args)}`;
      const now = Date.now();
      const cached = cache.get(key);

      if (cached && (options.ttl === undefined || cached.expiry > now)) {
        return cached.value;
      }

      const result = originalMethod.apply(this, args);

      // Handle promises
      if (result && typeof result.then === 'function') {
        return result.then((value: any) => {
          const expiry = options.ttl ? now + options.ttl : Number.MAX_SAFE_INTEGER;
          cache.set(key, {value, expiry});

          return value;
        });
      }

      const expiry = options.ttl ? now + options.ttl : Number.MAX_SAFE_INTEGER;
      cache.set(key, {value: result, expiry});

      return result;
    };

    return descriptor;
  };
}

/**
 * Webex validation decorator that uses class-validator
 * @returns {MethodDecorator} Method decorator function
 */
export function WebexValidate(): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@WebexValidate can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // Validate 'this' object if it has validation decorators
      const errors = validateSync(this);
      if (errors.length > 0) {
        throw new Error(
          `Validation failed: ${errors
            .map((e) => Object.values(e.constraints || {}))
            .flat()
            .join(', ')}`
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Auto-retry decorator for network operations
 * @param {number} attempts - Number of retry attempts (default: 3)
 * @param {number} delay - Base delay between retries in milliseconds (default: 1000)
 * @returns {MethodDecorator} Method decorator function
 */
export function WebexRetry(attempts = 3, delay = 1000): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@WebexRetry can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (attempt === attempts) break;

          // Wait before retry - use Promise constructor with void return
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), delay * attempt);
          });
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Timeout decorator for async operations
 * @param {number} ms - Timeout duration in milliseconds
 * @returns {MethodDecorator} Method decorator function
 */
export function WebexTimeout(ms: number): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@WebexTimeout can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);

      if (result && typeof result.then === 'function') {
        return Promise.race([
          result,
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
          }),
        ]);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Loading state decorator for async operations
 * Replaces the legacy @whileInFlight decorator
 * @param {string} propertyName - The property name to set to true/false during operation
 * @returns {MethodDecorator} Method decorator function
 */
export function WebexLoadingState(propertyName: string): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(
        `@WebexLoadingState can only be applied to methods, got: ${typeof descriptor?.value}`
      );
    }
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // Set loading state to true
      this[propertyName] = true;

      const result = originalMethod.apply(this, args);

      // Handle promises
      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            this[propertyName] = false;

            return value;
          })
          .catch((error: any) => {
            this[propertyName] = false;
            throw error;
          });
      }

      // Handle synchronous operations
      this[propertyName] = false;

      return result;
    };

    return descriptor;
  };
}

// export classes for external use
export {WebexConfigurable, WebexRequest, WebexResponse};
