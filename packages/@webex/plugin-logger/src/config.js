/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @typedef {Object} LoggerConfig
 * @property {string} [level=process.env.WEBEX_LOG_LEVEL] - Maximum log level that
 * should be printed to the console. One of
 * silent|error|warn|log|info|debug|trace
 * @property {Object<string, Function>} [consoleMethods] - Host console functions, keyed by normal method name.
 * Buffered calls use a supplied function. Printed-only calls and missing keys use the normal console method.
 * @property {number} [historyLength=10000] - Maximum number of entries to store in the log buffer.
 * @example
 * // The host saved console.info as console.stdinfo before it installed console capture.
 * // Supply the function itself. The SDK does not require the std prefix.
 * {
 *   level: process.env.WEBEX_LOG_LEVEL,
 *   historyLength: 10000,
 *   consoleMethods: {info: console.stdinfo}
 * }
 */

export default {
  logger: {
    level: process.env.WEBEX_LOG_LEVEL,
    historyLength: 10000,
  },
};
