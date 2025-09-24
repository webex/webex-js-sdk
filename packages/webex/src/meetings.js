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
require('@webex/internal-plugin-voicea');
require('@webex/plugin-people');
require('@webex/internal-plugin-llm');

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
        sdkType: 'meetings',
        meetings: {
          disableHydraId: true,
        },
      },
      config,
      newAttrs.config
    );

    return new Webex(newAttrs);
  }
}

module.exports = Webex;
