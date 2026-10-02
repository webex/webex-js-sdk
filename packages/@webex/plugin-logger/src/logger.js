/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser, patterns} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';
import {cloneDeep, has, isArray, isObject, isString} from 'lodash';

import {createWebexLogRecord, LOG_SOURCES} from './log-record';

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

const LOG_TYPES = {
  SDK: 'sdk',
  CLIENT: 'client',
};

const SDK_LOG_TYPE_NAME = 'wx-js-sdk';

const authTokenKeyPattern = /[Aa]uthorization/;
const authTokenValuePattern = /\b(Basic|Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi;
const legacyLineByRecord = new WeakMap();
const orderByRecord = new WeakMap();

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
        return object.replace(patterns.containsEmails, '[REDACTED]');
      }
      if (patterns.containsMTID.test(object)) {
        return object.replace(patterns.containsMTID, '$1[REDACTED]');
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
      return log[1];
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

    return buffer.join('\n');
  },

  /**
   * Marks the current diff cursor as successfully uploaded.
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
   * Restores the diff cursor to the last successful legacy upload.
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

  /**
   * Formats canonical records using their original legacy support-log lines.
   * @param {Array<Object>} records canonical records from this logger
   * @returns {string} legacy upload body
   */
  formatLogRecords(records) {
    return records
      .map((record) => legacyLineByRecord.get(record))
      .filter(Boolean)
      .join('\n');
  },

  /**
   * Replaces the configured destination set. Records continue to enter the
   * existing bounded SDK buffer until flushTransports acknowledges them.
   * @param {Object} options transport configuration
   * @param {Array<Object>} options.transports exact destination set
   * @returns {void}
   */
  configureTransports({transports}) {
    if (!isArray(transports)) {
      throw new TypeError('Logger transports must be an array');
    }

    transports.forEach((transport) => {
      if (!transport || !isString(transport.name) || typeof transport.export !== 'function') {
        throw new TypeError('Logger transports require a name and export function');
      }
    });

    this._logTransports = transports.slice();
    this._transportsShutdown = false;
  },

  /**
   * Exports one ordered immutable snapshot and removes it only after every
   * configured transport acknowledges success.
   * @param {Object} options flush options
   * @param {number} options.maxRecords maximum records in this snapshot
   * @returns {Promise<Object>} exported and remaining counts
   */
  flushTransports({maxRecords = Number.MAX_SAFE_INTEGER} = {}) {
    const run = async () => {
      const transports = this._logTransports || [];
      const bufferRefs = this.config.separateLogBuffers
        ? [this.sdkBuffer, this.clientBuffer]
        : [this.buffer];
      const orderedEntries = bufferRefs
        .flatMap((bufferRef, bufferOrder) =>
          bufferRef.buffer.map((entry, entryOrder) => ({bufferOrder, bufferRef, entry, entryOrder}))
        )
        .sort(
          (left, right) =>
            left.entry.record.timestamp - right.entry.record.timestamp ||
            orderByRecord.get(left.entry.record) - orderByRecord.get(right.entry.record) ||
            left.bufferOrder - right.bufferOrder ||
            left.entryOrder - right.entryOrder
        );
      const boundedMaxRecords = Number.isFinite(maxRecords)
        ? Math.max(0, Math.floor(maxRecords))
        : orderedEntries.length;
      const selectedEntries = orderedEntries.slice(0, boundedMaxRecords);

      if (!transports.length || (!selectedEntries.length && !this._pendingTransportFlush)) {
        return {exported: 0, remaining: orderedEntries.length};
      }

      const pending = this._pendingTransportFlush || {
        entries: selectedEntries,
        records: Object.freeze(selectedEntries.map(({entry}) => entry.record)),
        transports: transports.slice(),
      };

      this._pendingTransportFlush = pending;

      const results = await Promise.all(
        pending.transports.map((transport) =>
          transport.export(pending.records).then(
            () => ({succeeded: true, transport}),
            (error) => ({error, succeeded: false, transport})
          )
        )
      );
      const failedResults = results.filter(({succeeded}) => !succeeded);

      pending.transports = failedResults.map(({transport}) => transport);

      if (failedResults.length) {
        throw failedResults[0].error;
      }

      const selected = new Set(pending.entries.map(({entry}) => entry));

      bufferRefs.forEach((bufferRef) => {
        const removedBeforeNextIndex = bufferRef.buffer
          .slice(0, bufferRef.nextIndex)
          .filter((entry) => selected.has(entry)).length;
        const removedBeforeLastSubmitted = bufferRef.buffer
          .slice(0, bufferRef.lastSubmitted)
          .filter((entry) => selected.has(entry)).length;

        bufferRef.buffer = bufferRef.buffer.filter((entry) => !selected.has(entry));
        bufferRef.nextIndex = Math.max(0, bufferRef.nextIndex - removedBeforeNextIndex);
        bufferRef.lastSubmitted = Math.max(0, bufferRef.lastSubmitted - removedBeforeLastSubmitted);
      });

      this._pendingTransportFlush = undefined;

      return {
        exported: pending.entries.length,
        remaining: orderedEntries.length - pending.entries.length,
      };
    };

    this._transportFlush = (this._transportFlush || Promise.resolve()).catch(() => {}).then(run);

    return this._transportFlush;
  },

  /**
   * Performs one final bounded flush and shuts down every configured transport.
   * @param {Object} options shutdown options
   * @param {number} options.maxRecords maximum records in the final snapshot
   * @returns {Promise<Object>} final flush result
   */
  async shutdownTransports(options) {
    if (this._transportsShutdown) {
      return {exported: 0, remaining: 0};
    }

    this._transportsShutdown = true;
    const transports = this._logTransports || [];
    let result;

    try {
      result = await this.flushTransports(options);
    } finally {
      await Promise.all(transports.map((transport) => transport.shutdown?.()));
    }

    return result;
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
 * @instance
 * @memberof Logger
 * @private
 * @memberof Logger
 * @returns {function} logger method with specified params
 */
function makeLoggerMethod(level, impl, type, neverPrint = false, alwaysBuffer = false) {
  // Much of the complexity in the following function is due to a test-mode-only
  // helper
  return function wrappedConsoleMethod(...args) {
    const structuredRecord = this._structuredLogRecord;
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
      const shouldPrint = !neverPrint && this.shouldPrint(level, logType);
      const shouldBuffer = alwaysBuffer || this.shouldBuffer(level);

      if (!shouldBuffer && !shouldPrint) {
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

      if (shouldBuffer) {
        const logDate = new Date();
        const record = createWebexLogRecord({
          level,
          source: logType === LOG_TYPES.SDK ? LOG_SOURCES.SDK : LOG_SOURCES.CLIENT,
          loggerName: clientName,
          timestamp: logDate.getTime(),
          body: stringified.slice(1).join(' '),
          eventName: structuredRecord?.eventName,
          eventId: structuredRecord?.eventId,
          eventIdPrefix: structuredRecord?.eventIdPrefix,
          traceId: structuredRecord?.traceId,
          spanId: structuredRecord?.spanId,
          attributes: structuredRecord?.attributes,
          filter: (value) => this.filter(value)[0],
        });

        stringified.unshift(logDate.toISOString());
        stringified.unshift('|  '.repeat(this.groupLevel));
        Object.defineProperty(stringified, 'record', {value: record});
        legacyLineByRecord.set(record, stringified);
        this._logRecordSequence = (this._logRecordSequence || 0) + 1;
        orderByRecord.set(record, this._logRecordSequence);
        bufferRef.buffer.push(stringified);
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
        if (level === 'group') this.groupLevel += 1;
        if (level === 'groupEnd' && this.groupLevel > 0) this.groupLevel -= 1;
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

levels.forEach((level) => {
  let impls = fallbacks[level];
  let impl = level;

  if (impls) {
    impls = impls.slice();
    // eslint-disable-next-line no-console
    while (!console[impl]) {
      impl = impls.pop();
    }
  }

  // eslint-disable-next-line complexity
  Logger.prototype[`client_${level}`] = makeLoggerMethod(level, impl, LOG_TYPES.CLIENT);
  Logger.prototype[level] = makeLoggerMethod(level, impl, LOG_TYPES.SDK);
});

Logger.prototype.client_logToBuffer = makeLoggerMethod(
  levels.info,
  levels.info,
  LOG_TYPES.CLIENT,
  true,
  true
);
Logger.prototype.logToBuffer = makeLoggerMethod(
  levels.info,
  levels.info,
  LOG_TYPES.SDK,
  true,
  true
);

Logger.prototype.client_logRecord = function clientLogRecord(record) {
  if (!record || !levels.includes(record.level) || !isString(record.message)) {
    throw new TypeError('Structured log record requires a supported level and string message');
  }

  this._structuredLogRecord = record;

  try {
    return this[`client_${record.level}`](record.message);
  } finally {
    this._structuredLogRecord = undefined;
  }
};

export default Logger;
