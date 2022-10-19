/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin} from '@webex/webex-core';

import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-device';
import Flag from './flag';
import config from './config';

registerInternalPlugin('flag', Flag, {
  config,
  payloadTransformer: {
    predicates: [],
    transforms: []
  }
});

export {default} from './flag';
