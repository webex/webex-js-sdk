/**!
 *
 * Copyright (c) 2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/**
 * Helper for converting booleans into an sdp-style direction string
 * @param {Boolean} sending
 * @param {Boolean} receiving
 * @returns {String}
 */
export default function boolToStatus(sending, receiving) {
  if (sending && receiving) {
    return `sendrecv`;
  }

  if (sending && !receiving) {
    return `sendonly`;
  }

  if (!sending && receiving) {
    return `recvonly`;
  }

  if (!sending && !receiving) {
    return `inactive`;
  }

  throw new Error(`If you see this error, your JavaScript engine has a major flaw`);
}
