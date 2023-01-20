/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @typedef {Object} LoggerConfig
 * @property {string} [level=process.env.WEBEX_LOG_LEVEL] - Maximum log level that
 * should be printed to the console. One of
 * silent|error|warn|log|info|debug|trace
 * @property {number} [historyLength=1000] - Maximum number of entries to store in the log buffer.
 * @example
 * {
 *   level: process.env.WEBEX_LOG_LEVEL,
 *   historyLength: 1000
 * }
 */

export default {
  logger: {
    level: process.env.WEBEX_LOG_LEVEL,
    historyLength: 1000,
  },
};
