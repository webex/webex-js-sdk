/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint global-require: [0] */
/* eslint no-var: [0] */
/* eslint prefer-template: [0] */
/* eslint quotes: [0] */

/* istanbul ignore else */
if (!global._babelPolyfill) {
  require('babel-polyfill');
}

// helper file for code coverage
if (process.env.COVERAGE && (new RegExp(process.env.PACKAGE + '$')).test(require('../package').name)) {
  if (typeof window === 'undefined') {
    var covered = '../.coverage/src';
    module.exports = require(covered);
  }
  else {
    module.exports = require('../src');
  }
}
else {
  module.exports = require('..');
}
