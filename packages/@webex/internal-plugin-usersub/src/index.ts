/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin} from '@webex/webex-core';

import Usersub from './usersub';
import config from './config';

registerInternalPlugin('usersub', Usersub, {config});

export {default} from './usersub';
