/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {
  defaults,
  isString,
  wrap
} from 'lodash';

import evented from './evented';

import {
  initializers,
  trigger
} from './prop';

/**
 *
 * @param {Object|Function} options
 * @returns {[type]}
 */
export default function derived(options) {
  defaults(options, {
    cache: true,
    deps: []
  });
  const {
    cache,
    fn
  } = options;
  let {deps} = options;

  if (isString(deps)) {
    deps = [deps];
  }

  return function derivedDecorator(target, property, descriptor) {
    evented(target);

    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);
    descriptor.configurable = true;

    //
    // console.log(target);
    if (cache) {
      descriptor.initializer = function initializer() {
        deps.forEach((dep) => {
          this.on(`change:${dep}`, update.bind(this));
        });

        return Reflect.apply(fn, this, []);
      };
    }
    else {
      target.trigger = wrap(target.trigger, function triggerWrap(func, ...args) {
        const [eventName] = args;
        const ret = Reflect.apply(func, this, args);
        if (eventName.startsWith(`change:`) && eventName !== `change:${property}`) {
          console.log(eventName);
          trigger(this, `change:${property}`, this, Reflect.apply(fn, this, []));
        }
        return ret;
      });

      descriptor.get = function get() {
        return Reflect.apply(fn, this, []);
      };
    //   initializers.set(target, property, function initializer() {
    //     return Reflect.apply(fn, this, []);
    //   });
    //   const sym = Symbol();
    //   // FIXME this getter should have been picked up automatically
    //   descriptor.get = function get() {
    //     const newValue = Reflect.apply(initializers.get(target, property), this, []);
    //     if (!this[sym]) {
    //       this[sym] = true;
    //       trigger(this, `change:${property}`, this, newValue);
    //       Reflect.deleteProperty(this, sym);
    //     }
    //     return newValue;
    //   };
    }


    /**
    * @private
    * @returns {undefined}
    */
    function update() {
      /* eslint no-invalid-this: [0] */
      const currentVal = this[property];
      const newValue = Reflect.apply(fn, this, []);
      if (currentVal !== newValue || !cache) {
        const desc = Reflect.getOwnPropertyDescriptor(this, property);
        desc.value = newValue;
        Reflect.defineProperty(this, property, desc);

        trigger(this, `change:${property}`, this, newValue);
      }
    }
  };
}

export {derived as computed};
