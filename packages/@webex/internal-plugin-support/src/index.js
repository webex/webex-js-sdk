/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Support from './support';
import config from './config';

registerInternalPlugin('support', Support, {
  config,
});

export {default} from './support';
