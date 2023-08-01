/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See the LICENSE file.
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
// explicitly load wdm, since we're relying on preDiscoveryServices and the
// url interceptor
require('@webex/plugin-logger');
require('@webex/common');
require('@webex/plugin-meetings');
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-metrics');
require('@webex/internal-plugin-support');
require('@webex/internal-plugin-user');
require('@webex/plugin-people');

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
      sdkType: 'meetings',
      meetings: {
        disableHydraId: true,
      },
    },
    config,
    attrs.config
  ); // eslint-disable-line no-param-reassign

  return new Webex(attrs);
};

module.exports = Webex;
