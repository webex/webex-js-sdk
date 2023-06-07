/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import NewMetrics from './new-metrics';
import {userAgentToString} from './call-diagnostic/call-diagnostic-metrics.util';
import config from './config';

registerInternalPlugin('metrics', Metrics, {
  config,
});

export {default, getOSNameInternal} from './metrics';
export {config, NewMetrics, userAgentToString};
