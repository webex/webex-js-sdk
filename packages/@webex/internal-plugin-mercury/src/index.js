/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-feature';
import '@webex/internal-plugin-metrics';

import {registerInternalPlugin} from '@webex/webex-core';

import MercuryPlugin from './mercury-plugin';
import config from './config';

registerInternalPlugin('mercury', MercuryPlugin, {
  config,
  onBeforeLogout() {
    return this.logout();
  },
});

export {default} from './mercury';
export {default as Mercury} from './mercury';
export {MercuryPlugin} from './mercury-plugin';
export {default as Socket} from './socket';
export {default as config} from './config';
export {
  BadRequest,
  ConnectionError,
  Forbidden,
  NotAuthorized,
  UnknownResponse,
  // NotFound
} from './errors';
