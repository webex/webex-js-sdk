/* eslint-env browser */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {MemoryStoreAdapter} from '@webex/webex-core';

require('@webex/plugin-authorization');
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-calendar');
require('@webex/plugin-logger');
require('@webex/plugin-device-manager');

const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = {
  hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
  credentials: {
    clientType: 'confidential',
  },
  device: {
    ephemeral: true,
  },
  storage: {
    boundedAdapter: MemoryStoreAdapter,
    unboundedAdapter: MemoryStoreAdapter,
  },
};

const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

Webex.init = function init(attrs = {}) {
  attrs.config = merge({}, config, attrs.config); // eslint-disable-line no-param-reassign

  return new WebexCore(attrs);
};

window.webex = Webex;
