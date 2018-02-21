/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import fileType from 'file-type';
import {inBrowser} from '@ciscospark/common';

/**
 * Determine mimeType for the specified buffer;
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export default function detect(buffer) {
  return new Promise((resolve) => {
    resolve(detectSync(buffer));
  });
}

export {detect};

/**
 * Synchronous implementation of {@link detect}
 * @param {Buffer} buffer
 * @returns {string}
 */
export function detectSync(buffer) {
  /* global Blob */
  let b = buffer;
  if (inBrowser) {
    if (buffer instanceof Blob) {
      return buffer.type;
    }
    if (buffer instanceof ArrayBuffer) {
      b = new Uint8Array(buffer);
    }
    else if (!(buffer instanceof Uint8Array)) {
      throw new Error('`detect` requires a buffer of type Blob, ArrayBuffer, or Uint8Array');
    }
  }

  const type = fileType(b);

  if (!type) {
    return 'application/octet-stream';
  }

  return type.mime;
}
