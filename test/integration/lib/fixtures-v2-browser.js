'use strict';

// For some reason, the eslint-env browser directive isn't making File a known
// global
/* global File:false */
/* global ArrayBuffer, Uint8Array */

var assert = require('chai').assert;
var pick = require('lodash.pick');

var fixtureHelpers = {
  convertArrayBufferToBlob: function convertArrayBufferToBlob(buffer) {
    return new Blob([buffer]);
  },

  convertBlobToArrayBuffer: function convertBlobToArrayBuffer(blob) {
    assert.instanceOf(blob, Blob);

    return new Promise(function executor(resolve, reject) {
      var reader = new FileReader();

      reader.onerror = reject;
      reader.onload = function onload() {
        resolve(reader.result);
      };

      reader.readAsArrayBuffer(blob);
    });
  },

  convertBlobToImg: function convertBlobToImg(blob) {
    assert.instanceOf(blob, Blob);

    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  },

  convertUint8ArrayToArrayBuffer: function convertUint8ArrayToArrayBuffer(uint8Array) {
    assert.instanceOf(uint8Array, Uint8Array);
    return uint8Array.buffer;
  },

  determineImageDimensions: function determineImageDimensions(image) {
    return fixtureHelpers.ensureBlob(image)
      .then(fixtureHelpers.convertBlobToImg)
      .then(function(img) {
        return pick(img, 'height', 'width');
      });
  },

  ensureArrayBuffer: function ensureArrayBuffer(file) {
    if (fixtureHelpers.isBufferLike(file)) {
      return file;
    }

    if (file instanceof Blob) {
      return fixtureHelpers.convertBlobToArrayBuffer(file);
    }

    if (file instanceof Uint8Array) {
      return fixtureHelpers.convertUint8ArrayToArrayBuffer(file);
    }

    throw new Error('Could not determine file type');
  },

  ensureBlob: function ensureBlob(file) {
    return Promise.resolve(file)
      .then(function(file) {
        if (file instanceof File || file instanceof Blob) {
          return Promise.resolve(file);
        }

        if (file instanceof Uint8Array) {
          return fixtureHelpers.ensureBlob(fixtureHelpers.convertUint8ArrayToArrayBuffer(file));
        }

        if (file instanceof ArrayBuffer) {
          return fixtureHelpers.ensureBlob(fixtureHelpers.convertArrayBufferToBlob(file));
        }
      });
  },

  fetchFixture: function fetchFixture(filename) {
    var uri = '/fixtures/' + encodeURIComponent(filename);

    return new Promise(function executor(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true);
      xhr.responseType = 'blob';

      xhr.onload = function onload(event) {
        if (this.status !== 200) {
          reject(event);
        }
        else {
          // Add a name to the blob so it behaves just a little bit more like a
          // file.
          this.response.name = filename;
          resolve(this.response);
        }
      };

      xhr.onerror = function onerror(event) {
        reject(event);
      };

      xhr.send();
    });
  },

  isBufferLike: function isBufferLike(file) {
    return file instanceof ArrayBuffer;
  },

  isMatchingFile: function isMatchingFile(left, right) {
    return Promise.all([
      fixtureHelpers.ensureArrayBuffer(left),
      fixtureHelpers.ensureArrayBuffer(right)
    ])
      .then(function(buffers) {
        var left = buffers[0];
        var right = buffers[1];

        assert(fixtureHelpers.isBufferLike(left), '`left` should be an ArrayBuffer');
        assert(fixtureHelpers.isBufferLike(right), '`right` should be an ArrayBuffer');

        if (left.byteLength !== right.byteLength) {
          return false;
        }

        var l = new Uint8Array(left);
        var r = new Uint8Array(right);

        for (var i = 0; i < l.length; i++) {
          if (l[i] !== r[i]) {
            return false;
          }
        }

        return true;
      });
  }
};

module.exports = fixtureHelpers;
