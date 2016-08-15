/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {defaults, prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Only allows the specified property to be set once
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export default function setOnce(target, prop, descriptor) {
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
