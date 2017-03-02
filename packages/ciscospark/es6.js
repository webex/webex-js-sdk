/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint global-require: [0] */
/* eslint quotes: [0] */
/* eslint import/no-commonjs: [0] */

/* istanbul ignore else */
if (!global._babelPolyfill) {
  require('babel-polyfill');
}

module.exports = require('./dist');
