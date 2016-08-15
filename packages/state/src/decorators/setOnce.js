/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {initializers, prop} from './prop.js';
import {wrap} from 'lodash';

/**
 * Only allows the specified property to be set once
 * @param {Constructor} target
 * @param {string} property
 * @param {object} descriptor
 * @returns {undefined}
 */
export default function setOnce(target, property, descriptor) {
  // Reminder: sym is unique to the decorated attribute, not the class
  const sym = Symbol(`setOnce`);
  prop(target, property, descriptor);
  descriptor.set = wrap(descriptor.set, function setOnceExecutor(fn, newValue) {
    if (this[sym] || initializers.has(target, property)) {
      throw new TypeError(`${property} may only be set once`);
    }
    this[sym] = true;
    return Reflect.apply(fn, this, [newValue]);
  });
}
