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

const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

Webex.init = function init(attrs = {}) {
  attrs.config = merge(
    {
      sdkType: 'encryption',
    },
    config,
    attrs.config
  ); // eslint-disable-line no-param-reassign

  return new Webex(attrs);
};

module.exports = Webex;
