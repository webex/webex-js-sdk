/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* istanbul ignore else */
if (!global._babelPolyfill) {
  /* eslint global-require: [0] */
  require('@babel/polyfill');
}

// This file reuses webex.js but swaps in the first-party authorization plugin
require('@webex/plugin-authorization-browser-first-party');

module.exports = require('./webex');
