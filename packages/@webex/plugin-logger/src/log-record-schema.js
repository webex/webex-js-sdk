/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import uuid from 'uuid';

export const LOG_RECORD_SCHEMA_VERSION = 1;
export const LOG_RECORD_ATTRIBUTE_COUNT_LIMIT = 128;

export const LOG_TYPES = Object.freeze({
  SDK: 'sdk',
  CLIENT: 'client',
});

export const EVENT_INITIATOR_TYPES = Object.freeze({
  USER: 'user',
  REMOTE_USER: 'remote_user',
  SYSTEM: 'system',
  REMOTE_SYSTEM: 'remote_system',
  UNKNOWN: 'unknown',
});

export const EVENT_TRIGGER_TYPES = Object.freeze({
  UI: 'ui',
  HTTP: 'http',
  WEBSOCKET: 'websocket',
  TIMER: 'timer',
  LIFECYCLE: 'lifecycle',
  WORKER: 'worker',
  INTERNAL: 'internal',
});

export const LOG_ATTRIBUTE_KEYS = Object.freeze({
  SCHEMA_VERSION: 'webex.logger.schema_version',
  LOGGER_TYPE: 'webex.logger.type',
  LOGGER_NAME: 'webex.logger.name',
  EVENT_ID: 'webex.event.id',
  EVENT_INITIATOR_TYPE: 'webex.event.initiator.type',
  EVENT_TRIGGER_TYPE: 'webex.event.trigger.type',
  OPERATION_ID: 'webex.operation.id',
  MODULE: 'webex.module',
  USER_ID: 'enduser.id',
  ORG_ID: 'webex.org.id',
  SESSION_ID: 'webex.session.id',
  TRACKING_ID: 'webex.request.tracking_id',
  CORRELATION_ID: 'webex.correlation.id',
  SESSION_CORRELATION_ID: 'webex.session.correlation_id',
  FEEDBACK_ID: 'webex.feedback.id',
  CLIENT_CLOCK_TIMESTAMP: 'webex.client.clock.timestamp_unix_ms',
  SERVER_CLOCK_TIMESTAMP: 'webex.server.clock.estimated_timestamp_unix_ms',
  SERVER_CLOCK_OFFSET: 'webex.server.clock.offset_ms',
  SERVER_CLOCK_UNCERTAINTY: 'webex.server.clock.uncertainty_ms',
  SERVER_CLOCK_SYNC_AGE: 'webex.server.clock.sync_age_ms',
  ACTION_NAME: 'webex.action.name',
  NETWORK_ACTION: 'webex.network.action',
});

export const RESERVED_LOG_ATTRIBUTE_KEYS = Object.freeze([
  LOG_ATTRIBUTE_KEYS.SCHEMA_VERSION,
  LOG_ATTRIBUTE_KEYS.LOGGER_TYPE,
  LOG_ATTRIBUTE_KEYS.LOGGER_NAME,
  LOG_ATTRIBUTE_KEYS.EVENT_ID,
]);

export const EVENT_NAME_PATTERN = '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$';
export const EVENT_ID_PREFIX_PATTERN = '^[a-z][A-Za-z0-9]{0,63}$';
export const EVENT_ID_PATTERN =
  '^[a-z][A-Za-z0-9]{0,63}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
export const OTEL_TRACE_ID_PATTERN = '^[0-9a-f]{32}$';
export const OTEL_SPAN_ID_PATTERN = '^[0-9a-f]{16}$';

const eventNameRegExp = new RegExp(EVENT_NAME_PATTERN);
const eventIdPrefixRegExp = new RegExp(EVENT_ID_PREFIX_PATTERN);
const eventIdRegExp = new RegExp(EVENT_ID_PATTERN);
const traceIdRegExp = new RegExp(OTEL_TRACE_ID_PATTERN);
const spanIdRegExp = new RegExp(OTEL_SPAN_ID_PATTERN);

export const isValidEventName = (eventName) =>
  typeof eventName === 'string' && eventNameRegExp.test(eventName);

export const isValidEventIdPrefix = (prefix) =>
  typeof prefix === 'string' && eventIdPrefixRegExp.test(prefix);

export const isValidEventId = (eventId) =>
  typeof eventId === 'string' && eventIdRegExp.test(eventId);

export const isValidOpenTelemetryTraceId = (traceId) =>
  typeof traceId === 'string' && traceIdRegExp.test(traceId) && !/^0+$/.test(traceId);

export const isValidOpenTelemetrySpanId = (spanId) =>
  typeof spanId === 'string' && spanIdRegExp.test(spanId) && !/^0+$/.test(spanId);

export const getEventIdPrefix = (eventName) => {
  if (!isValidEventName(eventName)) {
    throw new TypeError(`Invalid event name: ${eventName}`);
  }

  const segments = eventName.split('.');
  const relevantSegments = segments[0] === 'webex' ? segments.slice(1) : segments;

  return relevantSegments
    .map((segment, index) => {
      const camelSegment = segment.replace(/_([a-z0-9])/g, (_match, character) =>
        character.toUpperCase()
      );

      return index === 0
        ? camelSegment
        : `${camelSegment.charAt(0).toUpperCase()}${camelSegment.slice(1)}`;
    })
    .join('');
};

export const createEventId = (prefix) => {
  if (!isValidEventIdPrefix(prefix)) {
    throw new TypeError(`Invalid event ID prefix: ${prefix}`);
  }

  return `${prefix}_${uuid.v4()}`;
};

export const logRecordSchema = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://webex.com/schemas/logger/log-record-v1.json',
  title: 'Webex structured log record',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'timestamp', 'level', 'type', 'name', 'message'],
  properties: {
    schemaVersion: {const: LOG_RECORD_SCHEMA_VERSION},
    timestamp: {type: 'integer', minimum: 0},
    level: {
      enum: ['error', 'warn', 'log', 'info', 'debug', 'trace', 'group', 'groupEnd'],
    },
    type: {enum: Object.values(LOG_TYPES)},
    name: {type: 'string', minLength: 1, maxLength: 128},
    message: {type: 'string'},
    eventName: {type: 'string', pattern: EVENT_NAME_PATTERN},
    eventId: {type: 'string', pattern: EVENT_ID_PATTERN},
    attributes: {
      type: 'object',
      maxProperties: LOG_RECORD_ATTRIBUTE_COUNT_LIMIT,
      propertyNames: {type: 'string', minLength: 1},
      properties: {
        [LOG_ATTRIBUTE_KEYS.EVENT_INITIATOR_TYPE]: {
          enum: Object.values(EVENT_INITIATOR_TYPES),
        },
        [LOG_ATTRIBUTE_KEYS.EVENT_TRIGGER_TYPE]: {
          enum: Object.values(EVENT_TRIGGER_TYPES),
        },
        [LOG_ATTRIBUTE_KEYS.OPERATION_ID]: {
          type: 'string',
          pattern: EVENT_ID_PATTERN,
        },
      },
      additionalProperties: {type: ['string', 'number', 'boolean']},
    },
  },
  dependentRequired: {
    eventId: ['eventName'],
  },
});
