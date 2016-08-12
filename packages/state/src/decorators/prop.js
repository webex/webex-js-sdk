/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {wrap} from 'lodash';
import WeakKeyedMap from '../lib/weak-keyed-map';
import evented from './evented';

/* eslint no-invalid-this: [0] */

const data = new WeakKeyedMap();
const defaults = new WeakKeyedMap();

const prepared = Symbol(`prepared`);
/**
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @private
 * @returns {undefined}
 */
function prepare(target, prop, descriptor) {
  evented(target);
  if (!descriptor[prepared]) {
    const initializer = descriptor.initializer;
    defaults.set(target, prop, initializer);
    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);

    descriptor.set = function set(newValue) {
      const currentVal = this[prop];
      if (currentVal !== newValue) {
        data.set(this, prop, newValue);
        this.trigger(`change:${prop}`, this, newValue);
        this.trigger(`change`, this);
      }
    };

    descriptor.get = function get() {
      const ret = data.get(this, prop);
      if (ret === undefined && initializer) {
        return initializer();
      }
      return ret;
    };

    descriptor[prepared] = true;
  }
}

/**
 * Locks the specifed property to a specific type
 * @param {string} dataType
 * @returns {undefined}
 */
export function type(dataType) {
  return function typeDecorator(target, prop, descriptor) {
    prepare(target, prop, descriptor);
    descriptor.set = wrap(descriptor.set, function typeExecutor(fn, newValue) {
      if (typeof newValue !== dataType) {
        throw new TypeError(`newValue must be of type ${dataType}`);
      }

      return Reflect.apply(fn, this, [newValue]);
    });
  };
}

/**
 * Does not allow the specifed property to be unset
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export function required(target, prop, descriptor) {
  prepare(target, prop, descriptor);
  descriptor.set = wrap(descriptor.set, function requiredExecutor(fn, newValue) {
    if (newValue === undefined && !defaults.has(target, prop)) {
      throw new TypeError(`${prop} cannot be undefined`);
    }
    return Reflect.apply(fn, this, [newValue]);
  });
}

/**
 * Limits the values to which the specific property may be set
 * @param {Array} allowedValues
 * @returns {function}
 */
export function values(allowedValues) {
  return function valuesDecorator(target, prop, descriptor) {
    prepare(target, prop, descriptor);
    descriptor.set = wrap(descriptor.set, function valuesExecutor(fn, newValue) {
      if (!allowedValues.includes(newValue)) {
        throw new TypeError(`${prop} must be one of (\`${allowedValues.join(`\`, \``)}\`)`);
      }

      return Reflect.apply(fn, this, [newValue]);
    });
  };
}

/**
 * Does not allow the specified property to be null
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export function notNull(target, prop, descriptor) {
  prepare(target, prop, descriptor);
  descriptor.set = wrap(descriptor.set, function notNullExecutor(fn, newValue) {
    if (newValue === null) {
      throw new TypeError(`${prop} may not be null`);
    }

    return Reflect.apply(fn, this, [newValue]);
  });
}

/**
 * Only allows the specified property to be set once
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export function setOnce(target, prop, descriptor) {
  const sym = Symbol(`setOnce`);
  prepare(target, prop, descriptor);
  descriptor.set = wrap(descriptor.set, function setOnceExecutor(fn, newValue) {
    if (this[sym] || defaults.has(target, prop)) {
      throw new TypeError(`${prop} may only be set once`);
    }
    this[sym] = true;
    return Reflect.apply(fn, this, [newValue]);
  });
}

/**
 * Runs new values through a negative validation test before allowing them to be
 * set
 * @param {Function} tester
 * @returns {Function}
 */
export function test(tester) {
  return function testDecorator(target, prop, descriptor) {
    prepare(target, prop, descriptor);
    descriptor.set = wrap(descriptor.set, function testExecutor(fn, newValue) {
      const error = Reflect.apply(tester, this, [newValue]);
      if (error) {
        throw new TypeError(error);
      }
      return Reflect.apply(fn, this, [newValue]);
    });
  };
}
