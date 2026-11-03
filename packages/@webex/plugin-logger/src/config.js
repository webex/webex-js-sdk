/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @typedef {Object} LoggerConfig
 * @property {string} [level=process.env.WEBEX_LOG_LEVEL] - Maximum log level that
 * should be printed to the console. One of
 * silent|error|warn|log|info|debug|trace
 * @property {Object<string, string>} [consoleMethods] - Saved console method names, keyed by normal method name.
 * Each value names a function on console. Buffered calls use that function with console as its receiver.
 * Printed-only calls, missing keys and unavailable saved methods use the normal console method.
 * @property {number} [historyLength=10000] - Maximum number of entries to store in the log buffer.
 * @example
 * // Save the function before installing host console capture. The host chooses the saved name.
 * console.stdinfo = console.info.bind(console);
 * const config = {
 *   level: process.env.WEBEX_LOG_LEVEL,
 *   historyLength: 10000,
 *   consoleMethods: {info: 'stdinfo'}
 * };
 */

export default {
  logger: {
    level: process.env.WEBEX_LOG_LEVEL,
    historyLength: 10000,
  },
};
