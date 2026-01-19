/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-conversation';

import {registerInternalPlugin} from '@webex/webex-core';

import Task from './task';
import config from './config';

registerInternalPlugin('task', Task, {
  config,
  payloadTransformer: {
    predicates: [],
    transforms: [],
  },
});

export {default} from './task';
