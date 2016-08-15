/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {defaults, prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Does not allow the specifed property to be unset
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export default function required(target, prop, descriptor) {
  prepare(target, prop, descriptor);
  descriptor.set = wrap(descriptor.set, function requiredExecutor(fn, newValue) {
    if (newValue === undefined && !defaults.has(target, prop)) {
      throw new TypeError(`${prop} cannot be undefined`);
    }
    return Reflect.apply(fn, this, [newValue]);
  });
}
