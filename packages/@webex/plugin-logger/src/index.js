/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@webex/webex-core';

import Logger from './logger';
import config from './config';

registerPlugin('logger', Logger, {
  config,
  replace: true,
});

export {default, levels} from './logger';
export {openTelemetryLogFormatter} from './formatters';
export {
  createEventId,
  EVENT_ID_PATTERN,
  EVENT_ID_PREFIX_PATTERN,
  EVENT_INITIATOR_TYPES,
  EVENT_NAME_PATTERN,
  EVENT_TRIGGER_TYPES,
  getEventIdPrefix,
  isValidEventId,
  isValidEventIdPrefix,
  isValidEventName,
  isValidOpenTelemetrySpanId,
  isValidOpenTelemetryTraceId,
  LOG_ATTRIBUTE_KEYS,
  LOG_RECORD_ATTRIBUTE_COUNT_LIMIT,
  LOG_RECORD_SCHEMA_VERSION,
  LOG_TYPES,
  logRecordSchema,
  OTEL_SPAN_ID_PATTERN,
  OTEL_TRACE_ID_PATTERN,
  RESERVED_LOG_ATTRIBUTE_KEYS,
} from './log-record-schema';
