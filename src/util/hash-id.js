/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var jose = require('node-jose');

/**
 * Converts a string (typically a URL) to a base64url-encoded, SHA256-hashed
 * unique-but-obfuscated identifier
 * @param {string} id The string to hash
 * @returns {Promise} THe hashed string
 */
function hashId(id) {
  return jose.JWA.digest('SHA-256', new Buffer(id))
    .then(function toString(buffer) {
      return buffer.toString();
    });
}

module.exports = hashId;
