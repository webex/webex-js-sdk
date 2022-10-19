/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import config from './config';

registerInternalPlugin('metrics', Metrics, {
  config
});

export {default} from './metrics';
export {config};
