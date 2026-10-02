/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {v4 as uuidV4} from 'uuid';

export const LOG_RECORD_SCHEMA_NAME = 'webex.log';
export const LOG_RECORD_SCHEMA_VERSION = '1.0.0';
export const LOG_RECORD_BODY_LENGTH_LIMIT = 32 * 1024;
export const LOG_RECORD_ATTRIBUTE_COUNT_LIMIT = 128;
export const LOG_RECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT = 1024;

export const LOG_SOURCES = Object.freeze({
  SDK: 'sdk',
  CLIENT: 'client',
} as const);

export const LOG_ATTRIBUTE_KEYS = Object.freeze({
  SCHEMA_NAME: 'webex.schema.name',
  SCHEMA_VERSION: 'webex.schema.version',
  RECORD_UID: 'log.record.uid',
  LOG_SOURCE: 'webex.log.source',
  LOGGER_NAME: 'webex.log.logger_name',
  CLIENT_CLOCK_TIMESTAMP: 'webex.clock.client.timestamp_unix_ms',
  EVENT_NAME: 'event.name',
  EVENT_ID: 'webex.event.id',
} as const);

export type WebexLogAttributeValue = string | number | boolean;
export type WebexLogAttributes = Record<string, WebexLogAttributeValue>;

export interface WebexLogRecordV1 {
  timestamp: number;
  severityNumber: number;
  severityText: string;
  body: string;
  eventName?: string;
  traceId?: string;
  spanId?: string;
  attributes: WebexLogAttributes;
}

const severityByLevel: Record<string, number> = {
  error: 17,
  warn: 13,
  log: 9,
  info: 9,
  debug: 5,
  trace: 1,
  group: 9,
  groupEnd: 9,
};

const reservedAttributeKeys = new Set(Object.values(LOG_ATTRIBUTE_KEYS));
const eventNamePattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const eventIdPrefixPattern = /^[a-z][A-Za-z0-9]{0,63}$/;
const traceIdPattern = /^[0-9a-f]{32}$/;
const spanIdPattern = /^[0-9a-f]{16}$/;

const truncate = (value: string, limit: number) =>
  value.length > limit ? value.slice(0, limit) : value;

const isValidTraceId = (value: unknown): value is string =>
  typeof value === 'string' && traceIdPattern.test(value) && !/^0+$/.test(value);

const isValidSpanId = (value: unknown): value is string =>
  typeof value === 'string' && spanIdPattern.test(value) && !/^0+$/.test(value);

type RecordInput = {
  level: string;
  source: (typeof LOG_SOURCES)[keyof typeof LOG_SOURCES];
  loggerName: string;
  timestamp: number;
  body: string;
  eventName?: unknown;
  eventId?: unknown;
  eventIdPrefix?: unknown;
  traceId?: unknown;
  spanId?: unknown;
  attributes?: unknown;
  filter: (value: unknown) => unknown;
};

export const createWebexLogRecord = ({
  level,
  source,
  loggerName,
  timestamp,
  body,
  eventName,
  eventId,
  eventIdPrefix,
  traceId,
  spanId,
  attributes,
  filter,
}: RecordInput): WebexLogRecordV1 => {
  const sanitizedAttributes =
    attributes && typeof attributes === 'object' && !Array.isArray(attributes)
      ? Object.entries(filter(attributes) as Record<string, unknown>).reduce<WebexLogAttributes>(
          (result, [key, value]) => {
            if (
              Object.keys(result).length < LOG_RECORD_ATTRIBUTE_COUNT_LIMIT &&
              key &&
              !reservedAttributeKeys.has(key) &&
              (typeof value === 'boolean' ||
                typeof value === 'string' ||
                (typeof value === 'number' && Number.isFinite(value)))
            ) {
              result[key] =
                typeof value === 'string'
                  ? truncate(value, LOG_RECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT)
                  : value;
            }

            return result;
          },
          {}
        )
      : {};
  const recordUid = uuidV4();
  const recordAttributes: WebexLogAttributes = {
    ...sanitizedAttributes,
    [LOG_ATTRIBUTE_KEYS.SCHEMA_NAME]: LOG_RECORD_SCHEMA_NAME,
    [LOG_ATTRIBUTE_KEYS.SCHEMA_VERSION]: LOG_RECORD_SCHEMA_VERSION,
    [LOG_ATTRIBUTE_KEYS.RECORD_UID]: recordUid,
    [LOG_ATTRIBUTE_KEYS.LOG_SOURCE]: source,
    [LOG_ATTRIBUTE_KEYS.LOGGER_NAME]: loggerName,
    [LOG_ATTRIBUTE_KEYS.CLIENT_CLOCK_TIMESTAMP]: timestamp,
  };
  const record: WebexLogRecordV1 = {
    timestamp,
    severityNumber: severityByLevel[level] ?? severityByLevel.info,
    severityText: (level || 'info').toUpperCase(),
    body: truncate(body, LOG_RECORD_BODY_LENGTH_LIMIT),
    attributes: recordAttributes,
  };

  if (typeof eventName === 'string') {
    const sanitizedEventName = filter(eventName);

    if (typeof sanitizedEventName !== 'string' || !eventNamePattern.test(sanitizedEventName)) {
      throw new TypeError(`Invalid event name: ${sanitizedEventName}`);
    }

    record.eventName = sanitizedEventName;
    recordAttributes[LOG_ATTRIBUTE_KEYS.EVENT_NAME] = sanitizedEventName;

    const prefix = eventIdPrefix ?? sanitizedEventName.split('.').slice(1).join('');

    if (eventId !== undefined) {
      recordAttributes[LOG_ATTRIBUTE_KEYS.EVENT_ID] = String(filter(eventId));
    } else if (typeof prefix === 'string' && eventIdPrefixPattern.test(prefix)) {
      recordAttributes[LOG_ATTRIBUTE_KEYS.EVENT_ID] = `${prefix}_${uuidV4()}`;
    }
  }

  if (isValidTraceId(traceId)) {
    record.traceId = traceId;
  }
  if (isValidSpanId(spanId)) {
    record.spanId = spanId;
  }

  Object.freeze(recordAttributes);

  return Object.freeze(record);
};
