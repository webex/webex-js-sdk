/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import NewMetrics from './new-metrics';
import {userAgentToString} from './call-diagnostic/call-diagnostic-metrics.util';
import config from './config';
import {ClientEvent} from './call-diagnostic/types/ClientEvent';

registerInternalPlugin('metrics', Metrics, {
  config,
});

// eslint-disable-next-line no-restricted-exports
export {default, getOSNameInternal} from './metrics';
export {config, NewMetrics, userAgentToString};
export type {ClientEvent};
