/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  logger: {
    /**
     * Maximum log level that should be printed to the console
     * @type {string} silent|error|warn|log|info|debug|trace
     */
    level: process.env.LOGGER_LEVEL,

    /**
     * Maximum number of entries to store in the log buffer.
     * @type {Number}
     */
    historyLength: 1000
  }
};
