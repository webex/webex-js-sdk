/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

module.exports = function debug() {
  if (process.env.DEBUG) {
    /* eslint no-console: [0] */
    console.info.apply(console, arguments);
  }
};
