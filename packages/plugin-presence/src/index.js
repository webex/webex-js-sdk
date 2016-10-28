/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Presence from './presence';
import config from './config';

import '@ciscospark/plugin-wdm';

registerPlugin(`presence`, Presence, {
  config
});

export {default as default} from './presence';
