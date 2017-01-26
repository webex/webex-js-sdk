/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import UrlSafeBase64 from 'urlsafe-base64';

/**
 * @param {string} str
 * @returns {string}
 */
export function fromBase64url(str) {
  return UrlSafeBase64.decode(str).toString();
}

/**
 * Converts a string to a base64url-encoded string
 * @param {string} str
 * @returns {string}
 */
export function toBase64Url(str) {
  return UrlSafeBase64.encode(new Buffer(str));
}

/**
 * Converts a string to a base64url-encoded string
 * @param {string} str
 * @returns {string}
 */
export function encode(str) {
  return toBase64Url(str);
}

/**
 * Converts a string from a base64url-encoded string
 * @param {string} str
 * @returns {string}
 */
export function decode(str) {
  return fromBase64url(str);
}

export default {
  fromBase64url,
  toBase64Url,
  encode,
  decode
};
