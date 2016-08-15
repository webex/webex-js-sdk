/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {isEqual} from 'lodash';
import WeakKeyedMap from '../lib/weak-keyed-map';
import evented from './evented';

/* eslint no-invalid-this: [0] */

const data = new WeakKeyedMap();
export const defaults = new WeakKeyedMap();

const prepared = new WeakKeyedMap();

/**
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @private
 * @returns {undefined}
 */
export function prepare(target, prop, descriptor) {
  evented(target);

  if (!prepared.has(target, prop)) {
    const initializer = descriptor.initializer;
    defaults.set(target, prop, initializer);
    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);

    descriptor.set = function set(newValue) {
      const currentVal = this[prop];
      if (!isEqual(currentVal, newValue)) {
        data.set(this, prop, newValue);
        this.trigger(`change:${prop}`, this, newValue);
      }
    };

    descriptor.get = function get() {
      const ret = data.get(this, prop);
      if (ret === undefined && initializer) {
        return initializer();
      }

      return ret;
    };

    prepared.set(target, prop, true);
  }
}
