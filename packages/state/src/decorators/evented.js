/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Events from 'ampersand-events';

const semaphore = Symbol(`evented`);

/**
 * Mixes ampersand-events into the target class or makes the specified property
 * evented
 * @param {Constructor} target
 * @returns {undefined}
 */
export default function evented(target) {
  if (!target[semaphore]) {
    // prototype is `target` if the decorator was called on a property and
    // `target.prototype` if it was called on a class.
    const prototype = target.prototype || target;
    Object.assign(prototype, Events);
  }
  target[semaphore] = true;
}
