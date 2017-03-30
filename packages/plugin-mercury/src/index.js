/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-feature';

import {registerPlugin} from '@ciscospark/spark-core';
import Mercury from './mercury';
import config from './config';

registerPlugin(`mercury`, Mercury, {
  config
});

export {default as default} from './mercury';
export {default as Mercury} from './mercury';
export {default as Socket} from './socket';
export {default as config} from './config';
export {
  BadRequest,
  ConnectionError,
  Forbidden,
  NotAuthorized
  // NotFound
} from './errors';
