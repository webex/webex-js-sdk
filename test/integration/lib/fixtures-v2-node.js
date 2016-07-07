'use strict';

var assert = require('chai').assert;
var fs = require('fs');
var gm = require('gm');
var Magic = require('mmmagic');
var path = require('path');
var pick = require('lodash.pick');

var fileHelpers = {
  determineImageDimensions: function determineImageDimensions(buffer) {
    return new Promise(function(resolve, reject) {
      gm(buffer)
        .size(function(err, size) {
          if (err) {
            reject(err);
          }
          else {
            resolve(pick(size, 'height', 'width'));
          }
        });
    });
  },

  isBufferLike: function isBufferLike(file) {
    return Buffer.isBuffer(file);
  },

  isMatchingFile: function isMatchingFile(left, right) {
    assert.isDefined(left);
    assert.isDefined(right);
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
  },

  fetchFixture: function fetchFixture(file) {
    return new Promise(function executor(resolve, reject) {
      var filename = path.join(__dirname, '..', 'fixtures', file);
      fs.readFile(filename, function callback(err, data) {
        if (err) {
          reject(err);
        }
        else {
          data.name = file;
          var magic = new Magic.Magic(Magic.MAGIC_MIME_TYPE);
          magic.detect(data, function(err, res) {
            if (err) {
              reject(err);
            }
            data.type = res;
            resolve(data);
          });
        }
      });
    });
  }
};

module.exports = fileHelpers;
