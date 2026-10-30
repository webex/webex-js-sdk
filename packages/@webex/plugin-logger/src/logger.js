/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser, patterns} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';
import {cloneDeep, has, isArray, isObject, isString} from 'lodash';

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
 * Build a record from one retained entry. Live events and history use this function.
 * @param {Array<mixed>} entry Formatted text with capture fields stored as named properties.
 * @returns {Object} A record that shares the caller-owned metadata values.
 */
function _createLogRecord(entry) {
  const record = {
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    // Both times use the captured acceptance time. Replay does not read the clock.
    observedTimestamp: entry.timestamp,
    level: entry.level,
    source: entry.source,
    body: entry.join(','),
  };

  if (entry.metadata) {
    record.eventName = entry.metadata.eventName;
    record.attributes = entry.metadata.attributes;
  }

  return record;
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
    // Keep the counter inside an object so increments do not emit Ampersand change events.
    recordState: {
      type: 'object',
      /**
       * Create empty state for this logger instance.
       * @returns {Object} The shared SDK and client sequence counter.
       */
      default() {
        return {
          // Last sequence assigned. Buffer trimming does not reset it.
          lastSequence: 0,
        };
      },
    },
    // Retained history and support-upload cursors when SDK and client logs share one buffer.
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
    // Current indentation depth for buffered groups.
    groupLevel: {
      type: 'number',
      default() {
        return 0;
      },
    },
    // Separate SDK history and support-upload cursors when configured.
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
    // Separate client history and support-upload cursors when configured.
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
   * Read retained entries in sequence order without changing support-upload cursors.
   * Use on('log:record', listener) for future records. Consumers must leave metadata unchanged.
   * @returns {Array} Records built from the retained entries.
   */
  getRecords() {
    const sdkBuffer = this.config.separateLogBuffers ? this.sdkBuffer.buffer : this.buffer.buffer;
    const clientBuffer = this.config.separateLogBuffers ? this.clientBuffer.buffer : [];
    const records = [];
    let sdkIndex = 0;
    let clientIndex = 0;

    while (sdkIndex < sdkBuffer.length || clientIndex < clientBuffer.length) {
      const sdkEntry = sdkBuffer[sdkIndex];
      const clientEntry = clientBuffer[clientIndex];

      if (sdkEntry && (!clientEntry || sdkEntry.sequence < clientEntry.sequence)) {
        records.push(_createLogRecord(sdkEntry));
        sdkIndex += 1;
      } else {
        records.push(_createLogRecord(clientEntry));
        clientIndex += 1;
      }
    }

    return records;
  },

  /**
   * Filter message data and extract configured metadata in one argument pass.
   * @param {Array<mixed>} args Message arguments.
   * @private
   * @returns {Object} Filtered arguments and metadata for this call.
   */
  _filterLogArguments(...args) {
    const {metadataField} = this.config;
    const filteredArguments = [];
    let metadata;

    args.forEach((argument) => {
      let arg = argument;

      // WebexHttpError already excludes auth tokens. Keep the existing Error handling.
      if (arg instanceof Error) {
        if (process.env.NODE_ENV === 'test' && inBrowser) {
          let ret = arg.toString();

          ret += 'BEGIN STACK';
          ret += arg.stack;
          ret += 'END STACK';
          filteredArguments.push(ret);
        } else {
          filteredArguments.push(arg);
        }

        return;
      }

      if (
        metadataField &&
        arg !== null &&
        typeof arg === 'object' &&
        !Array.isArray(arg) &&
        Object.prototype.hasOwnProperty.call(arg, metadataField)
      ) {
        // Keep metadata unchanged. Copy and redact only the remaining message fields.
        const {[metadataField]: recordMetadata, ...messageFields} = arg;

        metadata = recordMetadata;
        if (Object.keys(messageFields).length === 0) {
          return;
        }
        arg = messageFields;
      }

      filteredArguments.push(walkAndFilter(cloneDeep(arg)));
    });

    return {filteredArguments, metadata};
  },

  /**
   * Ensures auth headers don't get printed in logs
   * @param {Array<mixed>} args
   * @private
   * @memberof Logger
   * @returns {Array<mixed>}
   */
  filter(...args) {
    return this._filterLogArguments(...args).filteredArguments;
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
 * @param {Object} options - Internal formatting/buffering options.
 * @param {boolean} [options.neverPrint=false] - Never print to the console.
 * @param {boolean} [options.alwaysBuffer=false] - Retain regardless of the configured level.
 * @instance
 * @memberof Logger
 * @private
 * @memberof Logger
 * @returns {function} logger method with specified params
 */
function makeLoggerMethod(level, impl, type, {neverPrint = false, alwaysBuffer = false} = {}) {
  // Much of the complexity in the following function is due to a test-mode-only
  // helper
  return function wrappedConsoleMethod(...args) {
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

      const {filteredArguments, metadata} = this._filterLogArguments(...args);
      const filtered = [clientName, ...filteredArguments];
      const formatted = filtered.map((item) => {
        if (item instanceof Error) {
          return item.toString();
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
        // Print formatted browser values so later object changes do not change the displayed log.
        const toPrint = inBrowser ? formatted : filtered;

        /* istanbul ignore if */
        if (process.env.NODE_ENV === 'test' && has(this, 'webex.internal.device.url')) {
          toPrint.unshift(this.webex.internal.device.url.slice(-3));
        }
        // Use the saved method to avoid capturing SDK console output as another log.
        // eslint-disable-next-line no-console
        const consoleMethod = console[`std${impl}`] || console[impl];
        consoleMethod.apply(console, toPrint);
      }

      if (shouldBuffer) {
        const logDate = new Date();

        formatted.unshift(logDate.toISOString());
        formatted.unshift('|  '.repeat(this.groupLevel));
        this.recordState.lastSequence += 1;
        // Named fields retain record data without changing the support-log array positions.
        formatted.sequence = this.recordState.lastSequence;
        formatted.timestamp = logDate.getTime();
        formatted.level = level;
        formatted.source = metadata?.source || logType;
        formatted.metadata = metadata;
        bufferRef.buffer.push(formatted);
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
        if (level === 'group') {
          this.groupLevel += 1;
        }
        if (level === 'groupEnd' && this.groupLevel > 0) {
          this.groupLevel -= 1;
        }
        this.trigger('log:record', _createLogRecord(formatted));
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

Logger.prototype.client_logToBuffer = makeLoggerMethod('info', 'info', LOG_TYPES.CLIENT, {
  neverPrint: true,
  alwaysBuffer: true,
});
Logger.prototype.logToBuffer = makeLoggerMethod('info', 'info', LOG_TYPES.SDK, {
  neverPrint: true,
  alwaysBuffer: true,
});

export default Logger;
