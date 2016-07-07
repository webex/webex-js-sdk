/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/**
 * Sugar method for returning the desired object at the end of a promise chain
 * @memberof Util
 * @param {any} object the item with which to resolve the promise chain
 * @example
 * var item = {
 *   prop: 2
 * };
 * return Promise
 *  .resolve(item.prop)
 *  .then(resolveWith(item));
 *
 */
function resolveWith(object) {
  return function resolver() {
    return Promise.resolve(object);
  };
}

module.exports = resolveWith;
