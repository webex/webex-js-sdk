/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

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
  PreComputedLatencies,
} from './metrics.types';
import * as CALL_DIAGNOSTIC_CONFIG from './call-diagnostic/config';
import * as CallDiagnosticUtils from './call-diagnostic/call-diagnostic-metrics.util';
import CallDiagnosticMetrics from './call-diagnostic/call-diagnostic-metrics';
import CallDiagnosticLatencies from './call-diagnostic/call-diagnostic-metrics-latencies';
import BehavioralMetrics from './behavioral/behavioral-metrics';
import OperationalMetrics from './operational/operational-metrics';
import BusinessMetrics from './business/business-metrics';

registerInternalPlugin('metrics', Metrics, {
  config,
});

registerInternalPlugin('newMetrics', NewMetrics, {
  config,
});

export {default, getOSNameInternal} from './metrics';

export {
  config,
  CALL_DIAGNOSTIC_CONFIG,
  NewMetrics,
  Utils,
  CallDiagnosticUtils,
  CallDiagnosticLatencies,
  CallDiagnosticMetrics,
  BehavioralMetrics,
  OperationalMetrics,
  BusinessMetrics,
};
export type {
  ClientEvent,
  ClientEventLeaveReason,
  SubmitBehavioralEvent,
  SubmitClientEvent,
  SubmitInternalEvent,
  SubmitMQE,
  SubmitOperationalEvent,
  PreComputedLatencies,
};
