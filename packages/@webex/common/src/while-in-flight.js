/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-invalid-this: [0] */

import {wrap} from 'lodash';

import tap from './tap';

/**
 * While the promise returned by the decorated is unfullfilled, sets, the
 * specified boolean on the target class to `true`
 * @param {string} param
 * @returns {Function}
 */
export default function whileInFlight(param) {
  return function whileInFlightDecorator(target, name, descriptor) {
    descriptor.value = wrap(descriptor.value, function whileInFlightExecutor(fn, ...args) {
      return new Promise((resolve) => {
        this[param] = true;
        resolve(
          Reflect.apply(fn, this, args)
            .then(
              tap(() => {
                this[param] = false;
              })
            )
            .catch((reason) => {
              this[param] = false;

              return Promise.reject(reason);
            })
        );
      });
    });
  };
}
