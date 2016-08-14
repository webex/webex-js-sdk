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
  defaults(options, {
    cache: true
  });
  let {
    cache,
    fn,
    deps
  } = options;
  if (isFunction(options)) {
    cache = true;
    fn = options;
    deps = undefined;
  }

  if (isString(deps)) {
    deps = [deps];
  }

  return function derivedDecorator(target, prop, descriptor) {
    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);
    descriptor.configurable = true;

    if (cache) {
      descriptor.initializer = function initializer() {
        if (deps) {
          deps.forEach((dep) => {
            this.on(`change:${dep}`, update.bind(this));
          });
        }
        else {
          this.on(`change`, update.bind(this));
        }

        return Reflect.apply(fn, this, []);
      };
    }
    else {
      descriptor.get = function get() {
        return Reflect.apply(fn, this, []);
      };
    }

    /**
    * @private
    * @returns {undefined}
    */
    function update() {
      /* eslint no-invalid-this: [0] */
      const currentVal = this[prop];
      const newValue = Reflect.apply(fn, this, []);
      if (currentVal !== newValue) {
        const desc = Reflect.getOwnPropertyDescriptor(this, prop);
        desc.value = newValue;
        Reflect.defineProperty(this, prop, desc);

        this.trigger(`change:${prop}`, this, newValue);
      }
    }
  };
}

export {derived as computed};
