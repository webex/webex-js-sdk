/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Does not allow the specified property to be null
 * @param {Constructor} target
 * @param {string} prop
 * @param {object} descriptor
 * @returns {undefined}
 */
export default function notNull(target, prop, descriptor) {
  prepare(target, prop, descriptor);
  descriptor.set = wrap(descriptor.set, function notNullExecutor(fn, newValue) {
    if (newValue === null) {
      throw new TypeError(`${prop} may not be null`);
    }

    return Reflect.apply(fn, this, [newValue]);
  });
}
