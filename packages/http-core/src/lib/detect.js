/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import fileType from 'file-type';

/**
 * Determine mimeType for the specified buffer;
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export default function detect(buffer) {
  if (typeof window === `undefined`) {
    return Promise.resolve(fileType(buffer).mime);
  }

  /* eslint-env browser */
  return Promise.resolve(fileType(new Uint8Array(buffer)).mime);

}
