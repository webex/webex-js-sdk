/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint global-require: [0] */
/* eslint quotes: [0] */

/* istanbul ignore else */
if (!global._babelPolyfill) {
  require('babel-polyfill');
}

module.exports = require('./dist').default;
