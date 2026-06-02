/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

import {fromBase64url, toBase64Url} from './base64';

/**
 * Encodes a state object for transport through OAuth redirect query strings.
 * Serializes as JSON and encodes as base64url. Pairs with `decodeState`.
 * @param {Object} state
 * @returns {string}
 */
export function encodeState(state) {
  return toBase64Url(JSON.stringify(state));
}

/**
 * Decodes a base64url-encoded state string back into the original object.
 * Pairs with `encodeState`. Throws if the input is not valid base64url JSON.
 * @param {string} encoded
 * @returns {Object}
 */
export function decodeState(encoded) {
  return JSON.parse(fromBase64url(encoded));
}
