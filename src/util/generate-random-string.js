/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/**
 * Generates a random string
 * @memberof Util
 * @name generateRandomString
 * @param {integer} length
 * @returns {string}
 */
function generateRandomString(length) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  var text = '';
  for (var i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random()*chars.length));
  }

  return text;
}

module.exports = generateRandomString;
