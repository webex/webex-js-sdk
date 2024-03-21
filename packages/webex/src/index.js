/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* istanbul ignore else */
if (!global._babelPolyfill) {
  /* eslint global-require: [0] */
  require('@babel/polyfill');
}

module.exports = require('./webex');

/**
 * The date and time, specified in ISO 8601 extended offset date/time
 * format (e.g. `2015-10-18T14:26:16+00:00`).
 *
 * @typedef {string} isoDate
 */

/**
 * An email address, as a string.
 * @typedef {string} email
 */
