/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/internal-plugin-feature';
import '@ciscospark/internal-plugin-metrics';

import {registerInternalPlugin} from '@ciscospark/spark-core';
import Mercury from './mercury';
import config from './config';

registerInternalPlugin('mercury', Mercury, {
  config,
  onBeforeLogout() {
    return this.disconnect();
  }
});

export {default} from './mercury';
export {default as Mercury} from './mercury';
export {default as Socket} from './socket';
export {default as config} from './config';
export {
  BadRequest,
  ConnectionError,
  Forbidden,
  NotAuthorized,
  UnknownResponse
  // NotFound
} from './errors';
