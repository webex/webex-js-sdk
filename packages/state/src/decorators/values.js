/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prop} from './prop.js';
import {cloneDeep, wrap} from 'lodash';
import WeakKeyedMap from '../lib/weak-keyed-map';

const allowedValuesMap = new WeakKeyedMap();

export function getAllowedValues(target, property) {
  return cloneDeep(allowedValuesMap.get(target, property));
}

/**
 * Limits the values to which the specific property may be set
 * @param {Array} allowedValues
 * @returns {function}
 */
export default function values(allowedValues) {
  return function valuesDecorator(target, property, descriptor) {
    prop(target, property, descriptor);
    allowedValuesMap.set(target, property, allowedValues);
    allowedValues = cloneDeep(allowedValues);

    descriptor.set = wrap(descriptor.set, function valuesExecutor(fn, newValue) {
      if (!allowedValues.includes(newValue)) {
        throw new TypeError(`${property} must be one of (\`${allowedValues.join(`\`, \``)}\`)`);
      }

      return Reflect.apply(fn, this, [newValue]);
    });
  };
}
