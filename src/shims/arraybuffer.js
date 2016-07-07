/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */
/* global ArrayBuffer, Uint8Array */

/**
 * Returns a new ArrayBuffer whose contents are a copy of this ArrayBuffer's
 * bytes from `begin`, inclusive, up to `end`, exclusive
 * @see  http://stackoverflow.com/questions/21440050/arraybuffer-prototype-slice-shim-for-ie
 */
if (!ArrayBuffer.prototype.slice) {
  /* eslint no-extend-native: [0] */
  ArrayBuffer.prototype.slice = function slice(begin, end) {
    // If `begin` is unspecified, Chrome assumes 0, so we do the same
    if (begin === void 0) {
      begin = 0;
    }

    // If `end` is unspecified, the new ArrayBuffer contains all
    // bytes from `begin` to the end of this ArrayBuffer.
    if (end === void 0) {
      end = this.byteLength;
    }

    // Chrome converts the values to integers via flooring
    begin = Math.floor(begin);
    end = Math.floor(end);

    // If either `begin` or `end` is negative, it refers to an
    // index from the end of the array, as opposed to from the beginning.
    if (begin < 0) {
      begin += this.byteLength;
    }
    if (end < 0) {
      end += this.byteLength;
    }

    // The range specified by the `begin` and `end` values is clamped to the
    // valid index range for the current array.
    begin = Math.min(Math.max(0, begin), this.byteLength);
    end = Math.min(Math.max(0, end), this.byteLength);

    // If the computed length of the new ArrayBuffer would be negative, it
    // is clamped to zero.
    if (end - begin <= 0) {
      return new ArrayBuffer(0);
    }

    var result = new ArrayBuffer(end - begin);
    var resultBytes = new Uint8Array(result);
    var sourceBytes = new Uint8Array(this, begin, end - begin);

    resultBytes.set(sourceBytes);

    return result;
  };
}
