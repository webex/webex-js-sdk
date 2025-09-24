/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See the LICENSE file.
 */

// Note: this file is written using commonjs instead of import/export to
// simplify consumption by those less familiar with the current state of
// JavaScript modularization

/* istanbul ignore else */
if (!global._babelPolyfill) {
  /* eslint global-require: [0] */
  require('@babel/polyfill');
}

require('@webex/plugin-authorization');
require('@webex/internal-plugin-encryption'); // required
require('@webex/plugin-encryption');

const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = require('./config');

class Webex extends WebexCore {
  constructor(attrs) {
    super(attrs);
    this.webex = true;
    this.version = PACKAGE_VERSION;
  }

  static init(attrs = {}) {
    const newAttrs = {...attrs};
    newAttrs.config = merge(
      {
        sdkType: 'encryption',
      },
      config,
      newAttrs.config
    );

    return new Webex(newAttrs);
  }
}

module.exports = Webex;
