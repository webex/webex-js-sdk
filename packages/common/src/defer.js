/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Creates a new `Defer`red object,
 * @returns {Defer}
 */
export default function Defer() {
  this.promise = new Promise((resolve, reject) => {
    /**
     * @instance
     * @memberof Defer
     * @type {function}
     */
    this.resolve = resolve;
    /**
     * @instance
     * @memberof Defer
     * @type {function}
     */
    this.reject = reject;
  });
}
