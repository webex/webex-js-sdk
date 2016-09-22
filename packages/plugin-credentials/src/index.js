/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';

import {registerPlugin} from '@ciscospark/spark-core';
import Credentials from './credentials';
import config from './config';

registerPlugin(`credentials`, Credentials, {
  config
});

export {
  apiScope,
  default as default
} from './credentials';
export {default as default} from './credentials';
export {default as Token} from './token';
export {default as config} from './config';
