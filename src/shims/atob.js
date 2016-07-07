/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

if (typeof window !== 'undefined') {
  module.exports = window.atob;
}
else {
  // Put 'atob' in a variable so it doesn't get browserified
  var moduleName = 'atob';
  module.exports = require(moduleName);
}
