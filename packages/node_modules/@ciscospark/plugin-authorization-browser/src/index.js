/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import {registerPlugin} from '@ciscospark/spark-core';
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
