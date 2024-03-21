/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env: browser */

/**
 * Ensures the provider buffer is, indeed, an ArrayBuffer; converts File and
 * Blob objects to ArrayBuffers.
 * @param {mixed} buffer
 * @returns {Promise<ArrayBuffer>}
 */
export default function ensureBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return Promise.resolve(buffer);
  }

  if (buffer.toArrayBuffer) {
    return Promise.resolve(buffer.toArrayBuffer());
  }

  if (buffer.buffer) {
    return Promise.resolve(buffer.buffer);
  }

  return new Promise((resolve, reject) => {
    const fr = new FileReader();

    fr.onload = function onload() {
      resolve(new Uint8Array(this.result));
    };

    fr.onerror = reject;

    fr.readAsArrayBuffer(buffer);
  });
}
