/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser, patterns} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';
import {cloneDeep, has, isArray, isObject, isString} from 'lodash';

import {
  createEventId,
  EVENT_INITIATOR_TYPES,
  EVENT_TRIGGER_TYPES,
  getEventIdPrefix,
  isValidEventId,
  isValidEventIdPrefix,
  isValidEventName,
  LOG_ATTRIBUTE_KEYS,
  LOG_RECORD_ATTRIBUTE_COUNT_LIMIT,
  LOG_RECORD_SCHEMA_VERSION,
  LOG_TYPES,
  RESERVED_LOG_ATTRIBUTE_KEYS,
} from './log-record-schema';

const precedence = {
  silent: 0,
  group: 1,
  groupEnd: 2,
  error: 3,
  warn: 4,
  log: 5,
  info: 6,
  debug: 7,
  trace: 8,
};

export const levels = Object.keys(precedence).filter((level) => level !== 'silent');

const fallbacks = {
  error: ['log'],
  warn: ['error', 'log'],
  info: ['log'],
  debug: ['info', 'log'],
  trace: ['debug', 'info', 'log'],
};

const SDK_LOG_TYPE_NAME = 'wx-js-sdk';

const authTokenKeyPattern = /[Aa]uthorization/;
const authTokenValuePattern = /\b(Basic|Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi;
const reservedAttributeKeys = new Set(RESERVED_LOG_ATTRIBUTE_KEYS);
const eventInitiatorTypes = new Set(Object.values(EVENT_INITIATOR_TYPES));
const eventTriggerTypes = new Set(Object.values(EVENT_TRIGGER_TYPES));

/**
 * Recursively strips "authorization" fields from the specified object
 * @param {Object} object
 * @param {Array<mixed>} [visited]
 * @private
 * @returns {Object}
 */
function walkAndFilter(object, visited = []) {
  if (visited.includes(object)) {
    // Prevent circular references
    return object;
  }

  visited.push(object);

  if (isArray(object)) {
    return object.map((o) => walkAndFilter(o, visited));
  }
  if (!isObject(object)) {
    if (isString(object)) {
      object = object.replace(authTokenValuePattern, '$1 [REDACTED]');
      if (patterns.containsEmails.test(object)) {
        object = object.replace(patterns.containsEmails, '[REDACTED]');
      }
      if (patterns.containsMTID.test(object)) {
        object = object.replace(patterns.containsMTID, '$1[REDACTED]');
      }
    }

    return object;
  }

  for (const [key, value] of Object.entries(object)) {
    if (authTokenKeyPattern.test(key)) {
      Reflect.deleteProperty(object, key);
    } else {
      object[key] = walkAndFilter(value, visited);
    }
  }

  return object;
}

/**
 * Resolves the available console implementation for a log level.
 * @param {string} level log level
 * @returns {string} console method name
 */
function getConsoleImpl(level) {
  let impls = fallbacks[level];
  let impl = level;

  if (impls) {
    impls = impls.slice();
    // eslint-disable-next-line no-console
    while (!console[impl]) {
      impl = impls.pop();
    }
  }

  return impl;
}

/**
 * Filters structured attributes down to supported scalar values.
 * @param {Logger} logger logger instance
 * @param {Object} attributes candidate attributes
 * @returns {Object|undefined} sanitized attributes
 */
function sanitizeAttributes(logger, attributes) {
  if (!isObject(attributes) || isArray(attributes)) {
    return undefined;
  }

  const [filteredAttributes] = logger.filter(attributes);
  const sanitizedAttributes = Object.entries(filteredAttributes).reduce((result, [key, value]) => {
    if (Object.keys(result).length >= LOG_RECORD_ATTRIBUTE_COUNT_LIMIT) {
      return result;
    }

    const isInvalidTaxonomy =
      (key === LOG_ATTRIBUTE_KEYS.EVENT_INITIATOR_TYPE && !eventInitiatorTypes.has(value)) ||
      (key === LOG_ATTRIBUTE_KEYS.EVENT_TRIGGER_TYPE && !eventTriggerTypes.has(value));
    const isInvalidOperationId = key === LOG_ATTRIBUTE_KEYS.OPERATION_ID && !isValidEventId(value);

    if (
      key &&
      !reservedAttributeKeys.has(key) &&
      !isInvalidTaxonomy &&
      !isInvalidOperationId &&
      (typeof value === 'boolean' ||
        typeof value === 'string' ||
        (typeof value === 'number' && Number.isFinite(value)))
    ) {
      result[key] = value;
    }

    return result;
  }, {});

  return Object.keys(sanitizedAttributes).length ? sanitizedAttributes : undefined;
}

/**
 * Builds the SDK-owned structured log record.
 * @param {Logger} logger logger instance
 * @param {Object} options record inputs
 * @returns {Object} structured log record
 */
function createLogRecord(logger, {level, type, name, timestamp, stringified, structuredRecord}) {
  const record = {
    schemaVersion: LOG_RECORD_SCHEMA_VERSION,
    timestamp: timestamp.getTime(),
    level,
    type,
    name,
    message: stringified.slice(1).join(' '),
  };

  if (structuredRecord) {
    const attributes = sanitizeAttributes(logger, structuredRecord.attributes);

    if (attributes) {
      record.attributes = attributes;
    }

    if (isString(structuredRecord.eventName)) {
      const [eventName] = logger.filter(structuredRecord.eventName);

      if (!isValidEventName(eventName)) {
        throw new TypeError(`Invalid event name: ${eventName}`);
      }

      const eventIdPrefix = structuredRecord.eventIdPrefix || getEventIdPrefix(eventName);

      if (!isValidEventIdPrefix(eventIdPrefix)) {
        throw new TypeError(`Invalid event ID prefix: ${eventIdPrefix}`);
      }

      if (structuredRecord.eventId && !isValidEventId(structuredRecord.eventId)) {
        throw new TypeError(`Invalid event ID: ${structuredRecord.eventId}`);
      }

      record.eventName = eventName;
      record.eventId = structuredRecord.eventId || createEventId(eventIdPrefix);
    }
  }

  return record;
}

/**
 * Returns whether the configured transport array replaces the SDK defaults.
 * @param {Logger} logger logger instance
 * @returns {boolean} whether custom transports were explicitly configured
 */
function hasConfiguredTransports(logger) {
  return isArray(logger.config.transports);
}

/**
 * Delivers a formatted record to each configured transport.
 * @param {Logger} logger logger instance
 * @param {Object} record structured transport record
 * @returns {void}
 */
function writeToTransports(logger, record) {
  let formattedRecord = record;

  if (typeof logger.config.formatter === 'function') {
    try {
      formattedRecord = logger.config.formatter(record);
    } catch {
      return;
    }
  }

  if (!formattedRecord) {
    return;
  }

  logger.config.transports.forEach((transport) => {
    if (!transport || typeof transport.write !== 'function') {
      return;
    }

    try {
      transport.write(formattedRecord);
    } catch {
      // One transport must not prevent delivery to the remaining transports.
    }
  });
}

/**
 * Builds the structured buffer entry used by legacy log uploads.
 * @param {Object} record structured log record
 * @param {Array<string>} stringified filtered and stringified log values
 * @param {number} groupLevel current console group depth
 * @returns {Object} structured buffer entry
 */
function createBufferEntry(record, stringified, groupLevel) {
  return {
    record,
    legacyLine: [
      '|  '.repeat(groupLevel),
      new Date(record.timestamp).toISOString(),
      ...stringified,
    ],
  };
}

/**
 * Serializes one structured buffer entry to the existing upload format.
 * @param {Object} entry structured buffer entry
 * @returns {string} legacy upload line
 */
function formatBufferEntry(entry) {
  return entry.legacyLine.join(',');
}

/**
 * @class
 */
const Logger = WebexPlugin.extend({
  namespace: 'Logger',

  derived: {
    level: {
      cache: false,
      fn() {
        return this.getCurrentLevel();
      },
    },
    client_level: {
      cache: false,
      fn() {
        return this.getCurrentClientLevel();
      },
    },
  },
  session: {
    // for when configured to use single buffer
    buffer: {
      type: 'object',
      default() {
        return {
          buffer: [],
          nextIndex: 0,
          lastSubmitted: 0,
        };
      },
    },
    groupLevel: {
      type: 'number',
      default() {
        return 0;
      },
    },
    // for when configured to use separate buffers
    sdkBuffer: {
      type: 'object',
      default() {
        return {
          buffer: [],
          nextIndex: 0,
          lastSubmitted: 0,
        };
      },
    },
    clientBuffer: {
      type: 'object',
      default() {
        return {
          buffer: [],
          nextIndex: 0,
          lastSubmitted: 0,
        };
      },
    },
  },

  /**
   * Ensures auth headers don't get printed in logs
   * @param {Array<mixed>} args
   * @private
   * @memberof Logger
   * @returns {Array<mixed>}
   */
  filter(...args) {
    return args.map((arg) => {
      // WebexHttpError already ensures auth tokens don't get printed, so, no
      // need to alter it here.
      if (arg instanceof Error) {
        // karma logs won't print subclassed errors correctly, so we need
        // explicitly call their tostring methods.
        if (process.env.NODE_ENV === 'test' && inBrowser) {
          let ret = arg.toString();

          ret += 'BEGIN STACK';
          ret += arg.stack;
          ret += 'END STACK';

          return ret;
        }

        return arg;
      }

      arg = cloneDeep(arg);

      return walkAndFilter(arg);
    });
  },

  /**
   * Determines if the current level allows logs at the specified level to be
   * printed
   * @param {string} level
   * @param {string} type type of log, SDK or client
   * @private
   * @memberof Logger
   * @returns {boolean}
   */
  shouldPrint(level, type = LOG_TYPES.SDK) {
    return (
      precedence[level] <=
      precedence[type === LOG_TYPES.SDK ? this.getCurrentLevel() : this.getCurrentClientLevel()]
    );
  },

  /**
   * Determines if the current level allows logs at the specified level to be
   * put into the log buffer. We're configuring it omit trace and debug logs
   * because there are *a lot* of debug logs that really don't provide value at
   * runtime (they're helpful for debugging locally, but really just pollute the
   * uploaded logs and push useful info out).
   * @param {string} level
   * @param {string} type type of log, SDK or client
   * @private
   * @memberof Logger
   * @returns {boolean}
   */
  shouldBuffer(level) {
    return (
      precedence[level] <=
      (this.config.bufferLogLevel ? precedence[this.config.bufferLogLevel] : precedence.info)
    );
  },

  /**
   * Indicates the current SDK log level based on env vars, feature toggles, and
   * user type.
   * @instance
   * @memberof Logger
   * @private
   * @memberof Logger
   * @returns {string}
   */
  // eslint-disable-next-line complexity
  getCurrentLevel() {
    // If a level has been explicitly set via config, alway use it.
    if (this.config.level) {
      return this.config.level;
    }

    if (levels.includes(process.env.WEBEX_LOG_LEVEL)) {
      return process.env.WEBEX_LOG_LEVEL;
    }

    // Always use debug-level logging in test mode;
    if (process.env.NODE_ENV === 'test') {
      return 'trace';
    }

    // Use server-side-feature toggles to configure log levels
    const level =
      this.webex.internal.device && this.webex.internal.device.features.developer.get('log-level');

    if (level) {
      if (levels.includes(level)) {
        return level;
      }
    }

    return 'error';
  },

  /**
   * Indicates the current client log level based on config, defaults to SDK level
   * @instance
   * @memberof Logger
   * @private
   * @memberof Logger
   * @returns {string}
   */
  getCurrentClientLevel() {
    // If a client log level has been explicitly set via config, alway use it.
    if (this.config.clientLevel) {
      return this.config.clientLevel;
    }

    // otherwise default to SDK level
    return this.getCurrentLevel();
  },

  /**
   * Format logs (for upload)
   *
   * If separate client, SDK buffers is configured, merge the buffers, if configured
   *
   * @instance
   * @memberof Logger
   * @public
   * @memberof Logger
   * @param {Object} options
   * @param {boolean} options.diff whether to only format the diff from last call to formatLogs(), false by default
   * @returns {string} formatted buffer
   */
  formatLogs(options = {}) {
    function getDate(log) {
      return log.record.timestamp;
    }
    const {diff = false} = options;
    let buffer = [];
    let clientIndex = diff ? this.clientBuffer.nextIndex : 0;
    let sdkIndex = diff ? this.sdkBuffer.nextIndex : 0;

    if (this.config.separateLogBuffers) {
      // merge the client and sdk buffers
      // while we have entries in either buffer
      while (
        clientIndex < this.clientBuffer.buffer.length ||
        sdkIndex < this.sdkBuffer.buffer.length
      ) {
        // if we have remaining entries in the SDK buffer
        if (
          sdkIndex < this.sdkBuffer.buffer.length &&
          // and we haven't exhausted all the client buffer entries, or SDK date is before client date
          (clientIndex >= this.clientBuffer.buffer.length ||
            new Date(getDate(this.sdkBuffer.buffer[sdkIndex])) <=
              new Date(getDate(this.clientBuffer.buffer[clientIndex])))
        ) {
          // then add to the SDK buffer
          buffer.push(this.sdkBuffer.buffer[sdkIndex]);
          sdkIndex += 1;
        }
        // otherwise if we haven't exhausted all the client buffer entries, add client entry, whether it was because
        // it was the only remaining entries or date was later (the above if)
        else if (clientIndex < this.clientBuffer.buffer.length) {
          buffer.push(this.clientBuffer.buffer[clientIndex]);
          clientIndex += 1;
        }
      }
      if (diff) {
        this.clientBuffer.nextIndex = clientIndex;
        this.sdkBuffer.nextIndex = sdkIndex;
      }
    } else if (diff) {
      buffer = this.buffer.buffer.slice(this.buffer.nextIndex);
      this.buffer.nextIndex = this.buffer.buffer.length;
    } else {
      buffer = this.buffer.buffer;
    }

    return buffer.map(formatBufferEntry).join('\n');
  },

  /**
   * Update the last submitted index in the buffers to the current nextIndex
   *
   * @returns {void}
   */
  updateLastSubmittedIndex() {
    if (this.config.separateLogBuffers) {
      this.clientBuffer.lastSubmitted = this.clientBuffer.nextIndex;
      this.sdkBuffer.lastSubmitted = this.sdkBuffer.nextIndex;
    } else {
      this.buffer.lastSubmitted = this.buffer.nextIndex;
    }
  },

  /**
   * Reset the nextIndex in the buffers to the last successful upload index, effectively including any logs since the last successful upload in the next upload
   *
   * @returns {void}
   */
  resetBufferToLastSuccessfulUpload() {
    if (this.config.separateLogBuffers) {
      this.clientBuffer.nextIndex = this.clientBuffer.lastSubmitted;
      this.sdkBuffer.nextIndex = this.sdkBuffer.lastSubmitted;
    } else {
      this.buffer.nextIndex = this.buffer.lastSubmitted;
    }
  },
});

/**
 * Creates a logger method
 *
 *
 * @param {string} level level to create (info, error, warn, etc.)
 * @param {string} impl the level to use when writing to console
 * @param {string} type type of log, SDK or client
 * @param {bool} neverPrint function never prints to console
 * @param {bool} alwaysBuffer function always logs to log buffer
 * @param {bool} structured whether the method accepts a structured record
 * @returns {function} logger method with specified params
 */
function makeLoggerMethod(
  level,
  impl,
  type,
  neverPrint = false,
  alwaysBuffer = false,
  structured = false
) {
  // Much of the complexity in the following function is due to a test-mode-only
  // helper
  return function wrappedConsoleMethod(...args) {
    const structuredRecord = structured ? args[0] : undefined;

    if (structured) {
      args = [structuredRecord.message];
    }

    // it would be easier to just pass in the name and buffer here, but the config isn't completely initialized
    // in Ampersand, even if the initialize method is used to set this up.  so we keep the type to achieve
    // a sort of late binding to allow retrieving a name from config.
    const logType = type;
    const clientName =
      logType === LOG_TYPES.SDK ? SDK_LOG_TYPE_NAME : this.config.clientName || logType;

    let bufferRef;
    let historyLength;

    if (this.config.separateLogBuffers) {
      historyLength = this.config.clientHistoryLength
        ? this.config.clientHistoryLength
        : this.config.historyLength;
      bufferRef = logType === LOG_TYPES.SDK ? this.sdkBuffer : this.clientBuffer;
    } else {
      bufferRef = this.buffer;
      historyLength = this.config.historyLength;
    }

    try {
      const customTransportsConfigured = hasConfiguredTransports(this);
      const shouldPrint =
        !customTransportsConfigured && !neverPrint && this.shouldPrint(level, logType);
      const shouldBuffer =
        !customTransportsConfigured && (alwaysBuffer || this.shouldBuffer(level));
      const shouldTransport =
        customTransportsConfigured &&
        this.config.transports.length > 0 &&
        (alwaysBuffer || this.shouldBuffer(level));

      if (!shouldBuffer && !shouldPrint && !shouldTransport) {
        return;
      }

      const filtered = [clientName, ...this.filter(...args)];
      const stringified = filtered.map((item) => {
        if (item instanceof Error) {
          return walkAndFilter(item.toString());
        }
        if (typeof item === 'object') {
          let cache = [];
          let returnItem;
          try {
            returnItem = JSON.stringify(item, (_key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (cache.includes(value)) {
                  // Circular reference found, discard key
                  return undefined;
                }
                // Store value in our collection
                cache.push(value);
              }

              return value;
            });
          } catch (e) {
            returnItem = `Failed to stringify: ${item}`;
          }
          cache = null;

          return returnItem;
        }

        return item;
      });

      if (shouldPrint) {
        // when logging an object in browsers, we tend to get a dynamic
        // reference, thus going back to look at the logged value doesn't
        // necessarily show the state at log time, thus we print the stringified
        // value.
        const toPrint = inBrowser ? stringified : filtered;

        /* istanbul ignore if */
        if (process.env.NODE_ENV === 'test' && has(this, 'webex.internal.device.url')) {
          toPrint.unshift(this.webex.internal.device.url.slice(-3));
        }
        // eslint-disable-next-line no-console
        console[impl](...toPrint);
      }

      if (shouldBuffer || shouldTransport) {
        const logDate = new Date();
        const transportRecord = createLogRecord(this, {
          level,
          type: logType,
          name: clientName,
          timestamp: logDate,
          stringified,
          structuredRecord,
        });

        if (shouldBuffer) {
          bufferRef.buffer.push(createBufferEntry(transportRecord, stringified, this.groupLevel));
          if (bufferRef.buffer.length > historyLength) {
            // we've gone over the buffer limit, trim it down
            const deleteCount = bufferRef.buffer.length - historyLength;

            bufferRef.buffer.splice(0, deleteCount);

            // and adjust the corresponding buffer index used for log diff uploads
            bufferRef.nextIndex -= deleteCount;
            if (bufferRef.nextIndex < 0) {
              bufferRef.nextIndex = 0;
            }

            bufferRef.lastSubmitted -= deleteCount;
            if (bufferRef.lastSubmitted < 0) {
              bufferRef.lastSubmitted = 0;
            }
          }
        }
        if (level === 'group') this.groupLevel += 1;
        if (level === 'groupEnd' && this.groupLevel > 0) this.groupLevel -= 1;

        if (shouldTransport) {
          writeToTransports(this, transportRecord);
        }
      }
    } catch (reason) {
      if (!neverPrint) {
        /* istanbul ignore next */
        // eslint-disable-next-line no-console
        console.warn(`failed to execute Logger#${level}`, reason);
      }
    }
  };
}

const structuredClientMethods = {};

levels.forEach((level) => {
  const impl = getConsoleImpl(level);

  // eslint-disable-next-line complexity
  Logger.prototype[`client_${level}`] = makeLoggerMethod(level, impl, LOG_TYPES.CLIENT);
  Logger.prototype[level] = makeLoggerMethod(level, impl, LOG_TYPES.SDK);
  structuredClientMethods[level] = makeLoggerMethod(
    level,
    impl,
    LOG_TYPES.CLIENT,
    false,
    false,
    true
  );
});

/**
 * Writes a structured client record through the normal console, buffer, and optional transport path.
 *
 * @param {Object} record structured client record
 * @param {string} record.level log level
 * @param {string} record.message log message
 * @param {string} [record.eventName] event name
 * @param {string} [record.eventId] event instance identifier
 * @param {string} [record.eventIdPrefix] event identifier prefix
 * @param {Object} [record.attributes] scalar attributes
 * @private
 * @returns {void}
 */
Logger.prototype.client_logRecord = function clientLogRecord({
  level,
  message,
  eventName,
  eventId,
  eventIdPrefix,
  attributes,
}) {
  if (!levels.includes(level)) {
    throw new TypeError(`Unsupported log level: ${level}`);
  }
  if (!isString(message)) {
    throw new TypeError('Structured log message must be a string');
  }

  if (eventName !== undefined && !isValidEventName(eventName)) {
    throw new TypeError(`Invalid event name: ${eventName}`);
  }
  if (eventId !== undefined && !isValidEventId(eventId)) {
    throw new TypeError(`Invalid event ID: ${eventId}`);
  }
  if (eventIdPrefix !== undefined && !isValidEventIdPrefix(eventIdPrefix)) {
    throw new TypeError(`Invalid event ID prefix: ${eventIdPrefix}`);
  }
  if ((eventId || eventIdPrefix) && !eventName) {
    throw new TypeError('Structured event identifier requires an event name');
  }

  structuredClientMethods[level].call(this, {
    message,
    eventName,
    eventId,
    eventIdPrefix,
    attributes,
  });
};

Logger.prototype.client_logToBuffer = makeLoggerMethod(
  'info',
  'info',
  LOG_TYPES.CLIENT,
  true,
  true
);
Logger.prototype.logToBuffer = makeLoggerMethod('info', 'info', LOG_TYPES.SDK, true, true);

export default Logger;
