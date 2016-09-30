/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Search from './search';
import config from './config';
import SearchInterceptor from './interceptor';

import '@ciscospark/plugin-encryption';

registerPlugin(`search`, Search, {
  interceptors: {
    ConversationInterceptor: SearchInterceptor.create
  },
  config
});

export {default as default} from './search';
