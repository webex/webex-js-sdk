/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Limits the values to which the specific property may be set
 * @param {Array} allowedValues
 * @returns {function}
 */
export default function values(allowedValues) {
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
