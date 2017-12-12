import {make} from '@ciscospark/common';

const data = new (make(WeakMap, Map))();

/**
 * Given a class property, this decorator changes it into a setter/getter pair;
 * the setter will trigger `change:${prop}` when invoked
 * @param {Object} target
 * @param {string} prop
 * @param {Object} descriptor
 * @returns {undefined}
 */
export default function evented(target, prop, descriptor) {
  const defaultValue = descriptor.initializer && descriptor.initializer();

  Reflect.deleteProperty(descriptor, 'value');
  Reflect.deleteProperty(descriptor, 'initializer');
  Reflect.deleteProperty(descriptor, 'writable');

  descriptor.get = function get() {
    const value = data.get(this, prop);

    if (typeof value !== 'undefined') {
      return value;
    }

    return defaultValue;
  };

  descriptor.set = function set(value) {
    const previous = this[prop];
    if (previous !== value) {
      data.set(this, prop, value);
      this.trigger(`change:${prop}`, value, previous);
      this.trigger('change');
    }
  };
}
