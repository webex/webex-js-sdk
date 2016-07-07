/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */
/* global ArrayBuffer, DataView */

var pick = require('lodash.pick');
var imageBase = require('./image-base');

var ImageUtil = {

  processImage: function processImage(file, metadata, options) {
    if (file.type.indexOf('image') !== 0) {
      return Promise.reject();
    }

    return new Promise(function executor(resolve, reject) {
      var img = new Image();
      img.onload = function onload() {
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    })
      .then(function resizeImage(img) {
        metadata.dimensions = pick(img, 'height', 'width');

        var dimensions = imageBase._computeThumbnailDimensions(img, options);
        var canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        metadata.image = dimensions;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

        // TODO take advantage of canvas.toBlob in Firefox

        // modified from
        // http://www.nixtu.info/2013/06/how-to-upload-canvas-data-to-server.html

        // perform the split only once.
        var parts = canvas.toDataURL('image/png').split(',');

        // convert base64 to raw binary data held in a string
        var byteString = atob(parts[1]);

        // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString.length);
        var dw = new DataView(ab);
        for (var i = 0; i < byteString.length; i++) {
          dw.setUint8(i, byteString.charCodeAt(i));
        }

        return ab;
      }.bind(this));
  }
};

module.exports = ImageUtil;
