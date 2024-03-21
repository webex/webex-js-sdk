/*!
 * testing
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-mercury';

import {registerPlugin} from '@webex/webex-core';

import Rooms from './rooms';

registerPlugin('rooms', Rooms);

export default Rooms;
