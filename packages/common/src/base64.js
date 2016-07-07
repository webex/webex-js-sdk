/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import atob from './shims/atob';
import btoa from './shims/btoa';

/**
 * @param {string} str
 * @returns {string}
 */
export function fromBase64url(str) {
  return atob(str.replace(/\-/g, `+`).replace(/_/g, `/`));
}

/**
 * Converts a string to a base64url-encoded string
 * @param {string} str
 * @returns {string}
 */
export function toBase64Url(str) {
  return btoa(str)
    .replace(/\+/g, `-`)
    .replace(/\//g, `_`)
    .replace(/\=/g, ``);
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
