/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-user';
import '@webex/internal-plugin-device';

import Avatar from './avatar';
import config from './config';

export const avatarPlugin = [
  'avatar',
  Avatar,
  {
    config,
  },
];

export {default} from './avatar';
