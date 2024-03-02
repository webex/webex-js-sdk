/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {registerInternalPlugin} from '@webex/webex-core';

import Metrics from './metrics';
import config from './config';
import NewMetrics from './new-metrics';
import * as Utils from './utils';
import {
  ClientEvent,
  ClientEventLeaveReason,
  SubmitBehavioralEvent,
  SubmitClientEvent,
  SubmitInternalEvent,
  SubmitOperationalEvent,
  SubmitMQE,
} from './metrics.types';
import * as CALL_DIAGNOSTIC_CONFIG from './call-diagnostic/config';
import * as CallDiagnosticUtils from './call-diagnostic/call-diagnostic-metrics.util';

registerInternalPlugin('metrics', Metrics, {
  config,
});

registerInternalPlugin('newMetrics', NewMetrics, {
  config,
});

export {default, getOSNameInternal} from './metrics';
export {default as CallDiagnosticLatencies} from './call-diagnostic/call-diagnostic-metrics-latencies';
export {
  DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
  ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
  ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
  ICE_FAILURE_CLIENT_CODE,
  MISSING_ROAP_ANSWER_CLIENT_CODE,
  ERROR_DESCRIPTIONS,
} from './call-diagnostic/config';
export {config, CALL_DIAGNOSTIC_CONFIG, NewMetrics, Utils, CallDiagnosticUtils};
export type {
  ClientEvent,
  ClientEventLeaveReason,
  SubmitBehavioralEvent,
  SubmitClientEvent,
  SubmitInternalEvent,
  SubmitMQE,
  SubmitOperationalEvent,
};
