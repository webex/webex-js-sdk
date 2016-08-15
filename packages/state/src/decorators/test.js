/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {prepare} from './prop.js';
import {wrap} from 'lodash';

/**
 * Runs new values through a negative validation test before allowing them to be
 * set
 * @param {Function} tester
 * @returns {Function}
 */
export default function test(tester) {
  return function testDecorator(target, prop, descriptor) {
    prepare(target, prop, descriptor);
    descriptor.set = wrap(descriptor.set, function testExecutor(fn, newValue) {
      const error = Reflect.apply(tester, this, [newValue]);
      if (error) {
        throw new TypeError(error);
      }
      return Reflect.apply(fn, this, [newValue]);
    });
  };
}
