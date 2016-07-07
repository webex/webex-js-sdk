/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var btoa = require('../shims/btoa');
var atob = require('../shims/atob');

/**
 * @memberof Util
 * @module Base64
 */
module.exports =
  /** @lends Util.Base64 */
  {
  /**
   * @param {string} str
   * @return {string}
   */
  fromBase64url: function fromBase64url(str) {
    return atob(str.replace(/\-/g, '+').replace(/_/g, '/'));
  },

  /**
   * Converts a string to a base64url-encoded string
   * @param {string} str
   * @returns {string}
   */
  toBase64Url: function toBase64Url(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/\=/g, '');
  },

  /**
   * Decodes a base64-encoded String
   * @param {string} str
   * @returns {string}
   */
  decode: function decode(str) {
    return atob(str);
  }
};
