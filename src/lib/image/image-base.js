/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint complexity: [0] */
function _computeThumbnailDimensions(dimensions, options) {
  var maxHeight = options && options.maxHeight || 960;
  var maxWidth = options && options.maxWidth || 640;
  var height = dimensions.height;
  var width = dimensions.width;

  if (height > width) {
    if (height > maxHeight) {
      width = width*maxHeight/height;
      height = maxHeight;
    }

    if (width > maxWidth) {
      height = height*maxWidth/width;
      width = maxWidth;
    }
  }
  else {
    if (width > maxWidth) {
      height = height*maxWidth/width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = width*maxHeight/height;
      height = maxHeight;
    }
  }

  return {
    height: height,
    width: width
  };
}

module.exports = {
  _computeThumbnailDimensions: _computeThumbnailDimensions
};
