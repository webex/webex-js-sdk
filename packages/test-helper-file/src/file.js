/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var Magic = require('mmmagic');

var File = module.exports = {
  fetch: function fetch(filename) {
    return File.fetchWithoutMagic(filename)
      .then(function(data) {
        return new Promise((resolve, reject) => {
          var magic = new Magic.Magic(Magic.MAGIC_MIME_TYPE);
          magic.detect(data, function(err2, res) {
            if (err2) {
              reject(err2);
              return;
            }
            data.type = res;
            resolve(data);
          });
        });
      });
  },

  fetchWithoutMagic: function fetchWithoutMagic(filename) {
    return new Promise(function(resolve, reject) {
      var filepath = path.join(__dirname, '../../test-helper-server/src/static', filename);
      fs.readFile(filepath, function(err, data) {
        if (err) {
          reject(err);
          return;
        }
        data.name = filename;
        resolve(data);
      });
    });
  },

  isBufferLike: function isBufferLike(file) {
    return Buffer.isBuffer(file);
  },

  isBlobLike: function isBlobLike(file) {
    return Buffer.isBuffer(file);
  },

  isMatchingFile: function isMatchingFile(left, right) {
    if (!File.isBufferLike(left)) {
      throw new Error('`left` must be a `Buffer`');
    }

    if (!File.isBufferLike(right)) {
      throw new Error('`right` must be a `Buffer`');
    }

    // Node 10 doesn't have Buffer#equals()
    if (left.equals) {
      return Promise.resolve(left.equals(right));
    }

    if (left.length !== right.length) {
      return Promise.resolve(false);
    }

    for (var i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) {
        return Promise.resolve(false);
      }
    }

    return Promise.resolve(true);
  }
};
