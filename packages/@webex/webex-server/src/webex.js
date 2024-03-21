/*!
 *  Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@babel/polyfill';

import '@webex/plugin-authorization-node';
import '@webex/internal-plugin-avatar';
import '@webex/internal-plugin-board';
import '@webex/internal-plugin-calendar';
import '@webex/internal-plugin-conversation';
import '@webex/internal-plugin-encryption';
import '@webex/internal-plugin-feature';
import '@webex/internal-plugin-flag';
import '@webex/plugin-logger';
import '@webex/internal-plugin-mercury';
import '@webex/internal-plugin-metrics';
import '@webex/internal-plugin-search';
import '@webex/internal-plugin-support';
import '@webex/internal-plugin-team';
import '@webex/internal-plugin-user';
import '@webex/internal-plugin-device';

import WebexCore from '@webex/webex-core';

export default WebexCore;
