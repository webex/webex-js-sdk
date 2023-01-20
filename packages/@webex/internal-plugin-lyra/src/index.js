/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-mercury';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-feature';

import {registerInternalPlugin} from '@webex/webex-core';

import Lyra from './lyra';
import config from './config';

registerInternalPlugin('lyra', Lyra, {
  config,
});

export {default} from './lyra';
export {config};
