/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env: browser */
/* global FileReader */

export default function ensureBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return Promise.resolve(buffer);
  }

  if (buffer.toArrayBuffer) {
    return Promise.resolve(buffer.toArrayBuffer());
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
