/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import config from './config';
import NewMetrics from './new-metrics';
import {ClientEvent} from './metrics.types';
import * as CALL_DIAGNOSTIC_CONFIG from './call-diagnostic/config';

registerInternalPlugin('metrics', Metrics, {
  config,
});

export {default, getOSNameInternal} from './metrics';
export {config, NewMetrics, CALL_DIAGNOSTIC_CONFIG};
export type {ClientEvent};
