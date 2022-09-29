/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '../../webex-core';

import Credentials from './credentials';

registerPlugin('credentials', Credentials, {
  proxies: [
    'canAuthorize',
    'canRefresh'
  ]
});

export {default as Credentials} from './credentials';
export {filterScope, sortScope} from './scope';
export {default as Token} from './token';
export {default as grantErrors} from './grant-errors';
