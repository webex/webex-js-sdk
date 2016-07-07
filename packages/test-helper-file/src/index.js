/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

module.exports = require('./file');
