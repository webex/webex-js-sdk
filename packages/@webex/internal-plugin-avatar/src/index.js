/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-user';
import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Avatar from './avatar';
import config from './config';

registerInternalPlugin('avatar', Avatar, {
  config
});

export {default} from './avatar';
