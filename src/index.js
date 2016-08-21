/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

// Note: conditionals in this file are ignored for code coverage because they
// seem to report non-deterministically

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}

// JOSE depends on ArrayBuffer#slice, which isn't implemented in IE.
/* istanbul ignore next */
if (typeof window !== 'undefined') {
  require('./shims/arraybuffer');
}

module.exports = require('./spark');
