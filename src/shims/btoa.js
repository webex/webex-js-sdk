/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

if (typeof window !== 'undefined') {
  module.exports = window.btoa;
}
else {
  // Put 'btoa' in a variable so it doesn't get browserified
  var moduleName = 'btoa';
  module.exports = require(moduleName);
}
