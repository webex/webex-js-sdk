/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */
/* global ArrayBuffer, Uint8Array */

'use strict';

var makeLocalUrl = require('@ciscospark/test-helper-make-local-url');
var xhr = require('xhr');

/**
 * @param {Blob} blob
 * @private
 * @returns {Promise}
 */
function convertBlobToArrayBuffer(blob) {
  if (!(blob instanceof Blob)) {
    throw new Error('`blob` must be a `Blob`');
  }

  return new Promise(function(resolve, reject) {
    var reader = new FileReader();

    reader.onerror = reject;
    reader.onload = function onload() {
      resolve(reader.result);
    };

    reader.readAsArrayBuffer(blob);
  });
}

/**
 * @param {Uint8Array} array
 * @private
 * @returns {ArrayBuffer}
 */
function convertUin8ArrayToArrayBuffer(array) {
  if (!(array instanceof Uint8Array)) {
    throw new Error('`array` must be a `Uint8Array`');
  }
  return array.buffer;
}

/**
 * @param {mixed} file
 * @returns {Boolean}
 */
function isBlobLike(file) {
  return file instanceof Blob && 'size' in file && 'type' in file;
}

/**
 * @param {mixed} file
 * @returns {Boolean}
 */
function isBufferLike(file) {
  return file instanceof ArrayBuffer;
}

/**
 * @param {mixed} file
 * @private
 * @returns {Promise}
 */
function ensureArrayBuffer(file) {
  if (isBufferLike(file)) {
    return file;
  }

  if (isBlobLike(file)) {
    return convertBlobToArrayBuffer(file);
  }

  if (file instanceof Uint8Array) {
    return convertUin8ArrayToArrayBuffer(file);
  }

  throw new Error('Could not determine type of `file`');
}

function fetch(filename) {
  return new Promise(function(resolve, reject) {
    xhr({
      uri: makeLocalUrl('/' + filename),
      responseType: 'blob'
    }, function(err, res, body) {
      if (err) {
        reject(err);
      }
      else {
        body.name = body.name || filename;
        resolve(body);
      }
    });
  });
}

var FileShim = module.exports = {
  /**
   * @param {string} filename
   * @returns {Promise}
   */
  fetch: fetch,

  fetchWithoutMagic: fetch,

  isBufferLike: isBufferLike,

  isBlobLike: isBlobLike,

  /**
   * @param {ArrayBuffer|Blob|Uint8Array} left
   * @param {ArrayBuffer|Blob|Uint8Array} right
   * @returns {Boolean}
   */
  isMatchingFile: function isMatchingFile(left, right) {
    return Promise.all([
      ensureArrayBuffer(left),
      ensureArrayBuffer(right)
    ])
      .then(function(buffers) {
        var innerLeft = buffers[0];
        var innerRight = buffers[1];

        if (!FileShim.isBufferLike(innerLeft)) {
          throw new Error('`innerLeft` must be a `Buffer`');
        }

        if (!FileShim.isBufferLike(innerRight)) {
          throw new Error('`innerRight` must be a `Buffer`');
        }

        if (innerLeft.byteLength !== innerRight.byteLength) {
          return false;
        }

        var l = new Uint8Array(innerLeft);
        var r = new Uint8Array(innerRight);

        for (var i = 0; i < l.length; i++) {
          if (l[i] !== r[i]) {
            return false;
          }
        }

        return true;
      });
  }
};
