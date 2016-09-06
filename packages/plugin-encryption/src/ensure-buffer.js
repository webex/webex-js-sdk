/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

export default function ensureBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return Promise.reject(new Error(`\`buffer\` must be a buffer`));
  }

  return Promise.resolve(buffer);
}
