/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {initializers, prop} from './prop.js';
import {wrap} from 'lodash';

/**
 * Does not allow the specifed property to be unset
 * @param {Constructor} target
 * @param {string} property
 * @param {object} descriptor
 * @returns {undefined}
 */
export default function required(target, property, descriptor) {
  prop(target, property, descriptor);
  descriptor.set = wrap(descriptor.set, function requiredExecutor(fn, newValue) {
    if (newValue === undefined && !initializers.has(target, property)) {
      throw new TypeError(`${property} cannot be undefined`);
    }
    return Reflect.apply(fn, this, [newValue]);
  });
}
