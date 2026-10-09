/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {LOG_ATTRIBUTE_KEYS} from './log-record-schema';

const severityByLevel = {
  error: 17,
  warn: 13,
  log: 9,
  info: 9,
  debug: 5,
  trace: 1,
  group: 9,
  groupEnd: 9,
};

/**
 * Formats an SDK log record for the OpenTelemetry JavaScript Logs API.
 *
 * This intentionally does not import OpenTelemetry. The application owns the
 * OpenTelemetry provider, context, processors, and exporter.
 *
 * @param {Object} logRecord SDK structured log record
 * @returns {Object} OpenTelemetry-compatible log record
 */
export function openTelemetryLogFormatter(logRecord) {
  const record = {
    timestamp: new Date(logRecord.timestamp),
    observedTimestamp: new Date(),
    severityNumber: severityByLevel[logRecord.level] || severityByLevel.info,
    severityText: (logRecord.level || 'info').toUpperCase(),
    body: logRecord.message,
    attributes: {
      ...logRecord.attributes,
      [LOG_ATTRIBUTE_KEYS.SCHEMA_VERSION]: logRecord.schemaVersion,
      [LOG_ATTRIBUTE_KEYS.LOGGER_TYPE]: logRecord.type,
      [LOG_ATTRIBUTE_KEYS.LOGGER_NAME]: logRecord.name,
    },
  };

  if (logRecord.eventName) {
    record.eventName = logRecord.eventName;
    if (logRecord.eventId) {
      record.attributes[LOG_ATTRIBUTE_KEYS.EVENT_ID] = logRecord.eventId;
    }
  }

  return record;
}
