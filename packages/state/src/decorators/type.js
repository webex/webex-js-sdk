/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Locks the specifed property to a specific type
 * @param {string} dataType
 * @returns {undefined}
 */
export default function type(dataType) {
  return function typeDecorator(target, prop, descriptor) {
    descriptor.enumerable = descriptor.enumerable !== false;
    prepare(target, prop, descriptor);
    descriptor.set = wrap(descriptor.set, function typeExecutor(fn, newValue) {
      if (typeof newValue !== `undefined` && typeof newValue !== dataType) {
        throw new TypeError(`newValue must be of type ${dataType}`);
      }

      return Reflect.apply(fn, this, [newValue]);
    });
  };
}
