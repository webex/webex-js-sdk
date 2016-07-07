/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var gm = require('gm');
var pick = require('lodash.pick');
var imageBase = require('./image-base');

var ImageUtil = {

  processImage: function processImage(file, metadata, options) {

    return new Promise(function executor(resolve, reject) {
      gm(file)
      .size(function sizeCallback(err, size) {
        if (err) {
          reject(err);
        }
        else {
          metadata.dimensions = pick(size, 'height', 'width');
          resolve(metadata.dimensions);
        }
      });
    })
      .then(function computeDimensions(dimensions) {
        return imageBase._computeThumbnailDimensions(dimensions, options);
      })
      .then(function resizeImage(dimensions) {
        metadata.image = pick(dimensions, 'height', 'width');
        return new Promise(function execute(resolve, reject) {
          gm(file)
          .resize(dimensions.height, dimensions.width)
          .toBuffer('PNG', function toBufferCallback(err, buffer) {
            if (err) {
              reject(err);
            }
            else {
              resolve(buffer);
            }
          });
        });
      });
  }
};

module.exports = ImageUtil;
