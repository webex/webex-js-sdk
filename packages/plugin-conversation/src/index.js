/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// TODO remove activity parameter
// TODO implement remaining tests
// TODO verify conversation method names don't suck
// TODO avoid rewriting _inferConversationUrl in every method

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
