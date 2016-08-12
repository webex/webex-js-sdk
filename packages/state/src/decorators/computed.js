/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {isFunction, isString} from 'lodash';

/**
 *
 * @param {Object|Function} options
 * @returns {[type]}
 */
export default function derived(options) {
  let {
    fn,
    deps
  } = options;
  if (isFunction(options)) {
    fn = options;
    deps = undefined;
  }

  if (isString(deps)) {
    deps = [deps];
  }

  return function derivedDecorator(target, prop, descriptor) {
    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);

    descriptor.set = function set() {
      throw new Error(`Cannot assign to computed property ${prop}`);
    };

    descriptor.get = function get() {
      return Reflect.apply(fn, this, []);
    };
  };
}

export {derived as computed};
