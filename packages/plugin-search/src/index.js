/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Search from './search';
import config from './config';
import './interceptor';

import '@ciscospark/plugin-encryption';

registerPlugin(`search`, Search, {
  config
});

export {default as default} from './search';
