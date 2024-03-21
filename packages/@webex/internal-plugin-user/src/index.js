/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import User from './user';
import config from './config';

registerInternalPlugin('user', User, {
  config,
});

export {default} from './user';
