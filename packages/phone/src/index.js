/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

// Reminder: babel tends to reorder imports when turning them into requires, so
// recipe modules should be written using es5 syntax
if (!global._babelPolyfill) {
  /* eslint global-require: [0] */
  require('babel-polyfill');
}

require('@ciscospark/plugin-phone');
module.exports = require('ciscospark');
