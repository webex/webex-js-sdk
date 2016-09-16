/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Conversation from './conversation';
import config from './config';
import ConversationInterceptor from './interceptor.js';

import '@ciscospark/plugin-encryption';
import '@ciscospark/plugin-user';

registerPlugin(`conversation`, Conversation, {
  interceptors: {
    ConversationInterceptor: ConversationInterceptor.create
  },
  config
});

export {default as default} from './conversation';
export {default as ShareActivity} from './share-activity';
