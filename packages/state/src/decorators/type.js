/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prop} from './prop.js';
import {wrap} from 'lodash';
import WeakKeyedMap from '../lib/weak-keyed-map';

const types = new WeakKeyedMap();

export function getType(target, property) {
  return types.get(target, property);
}

/**
 * Locks the specifed property to a specific type
 * @param {string} dataType
 * @returns {undefined}
 */
export default function type(dataType) {
  return function typeDecorator(target, property, descriptor) {
    descriptor.enumerable = descriptor.enumerable !== false;
    prop(target, property, descriptor);
    types.set(target, property, dataType);

    descriptor.set = wrap(descriptor.set, function typeExecutor(fn, newValue) {
      if (typeof newValue !== `undefined` && typeof newValue !== dataType) {
        throw new TypeError(`newValue must be of type ${dataType}`);
      }

      return Reflect.apply(fn, this, [newValue]);
    });
  };
}
