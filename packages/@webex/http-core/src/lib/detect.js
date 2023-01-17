/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {fromBuffer} from 'file-type';

/**
 * Determine mimeType for the specified buffer;
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export default async function detect(buffer) {
  if (
    !(buffer instanceof Blob) &&
    !(buffer instanceof ArrayBuffer) &&
    !(buffer instanceof Uint8Array)
  ) {
    throw new Error('`detect` requires a buffer of type Blob, ArrayBuffer, or Uint8Array');
  }

  if (buffer instanceof Blob) {
    return buffer.type;
  }

  // `fromBuffer()` can take a buffer that is either a ArrayBuffer or Uinit8Array
  const fileType = await fromBuffer(buffer);

  if (!fileType) {
    return 'application/octet-stream';
  }

  return fileType.mime;
}
