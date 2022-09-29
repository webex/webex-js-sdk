/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import {registerPlugin} from '@webex/webex-core';

import Authorization from './authorization';
import config from './config';

const proxies = [
  'isAuthorizing',
  'isAuthenticating'
];

registerPlugin('authorization', Authorization, {
  config,
  proxies
});

export {default} from './authorization';
export {default as config} from './config';
