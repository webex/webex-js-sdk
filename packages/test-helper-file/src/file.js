/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var File = module.exports = {
  fetch: function fetch(filename) {
    return new Promise(function(resolve, reject) {
      var filepath = path.join(__dirname, '../../test-helper-server/src/static', filename);
      fs.readFile(filepath, function(err, data) {
        if (err) {
          return reject(err);
        }
        return resolve(data);
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
