/* eslint-env browser */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {MemoryStoreAdapter} from '@webex/webex-core';

import '@webex/plugin-authorization';
import '@webex/internal-plugin-device';
import '@webex/internal-plugin-calendar';
import '@webex/plugin-logger';
import '@webex/plugin-device-manager';

import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';

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

class Webex extends WebexCore {
  constructor(attrs) {
    super(attrs);
    this.webex = true;
    this.version = PACKAGE_VERSION;
  }

  static init(attrs = {}) {
    const newAttrs = {...attrs};
    newAttrs.config = merge({}, config, newAttrs.config);

    return new Webex(newAttrs);
  }
}

window.webex = Webex;

export default Webex;
