/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import UrlSafeBase64 from 'urlsafe-base64';
import {Buffer} from 'safe-buffer';

import isBuffer from './isBuffer';

/**
 * Converts a string from a base64url-encoded string
 * @param {string} str
 * @returns {string}
 */
export function fromBase64url(str) {
  return UrlSafeBase64.decode(str).toString();
}

/**
 * Converts a string to a base64url-encoded string. It also accepts a buffer
 * @param {string|buffer} str
 * @returns {string}
 */
export function toBase64Url(str) {
  let buffer = str;

  if (!isBuffer(buffer)) {
    buffer = Buffer.from(buffer);
  }

  return UrlSafeBase64.encode(buffer);
}

/**
 * Converts a string to a base64url-encoded string. It also accepts a buffer
 * @param {string|buffer} str
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

/**
 * Indicates if the provided string is, in fact, a base64 string
 * @param {String} str
 * @returns {Boolean}
 */
export function validate(str) {
  return UrlSafeBase64.validate(str);
}

export default {
  fromBase64url,
  toBase64Url,
  encode,
  decode,
  validate,
};
