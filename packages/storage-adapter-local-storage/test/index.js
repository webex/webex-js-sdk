/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-disable */

'use strict';

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
