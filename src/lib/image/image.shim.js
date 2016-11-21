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
  drawImage: function drawImage(options) {
    // save current context before applying transformations
    options.ctx.save();
    var rad;
    // convert degrees to radians
    if (options.flip) {
      rad = options.deg*Math.PI/180;
    }
    else {
      rad = 2*Math.PI - options.deg*Math.PI/180;
    }
    // set the origin to the center of the image
    options.ctx.translate(options.x + options.width/2, options.y + options.height/2);
    // rotate the canvas around the origin
    options.ctx.rotate(rad);
    if (options.flip) {
      // flip the canvas
      options.ctx.scale(-1,1);
    }
    // draw the image
    options.ctx.drawImage(options.img, -options.width/2, -options.height/2, options.width, options.height);
    // restore the canvas
    options.ctx.restore();
  },

  setImageOrientation: function setImageOrientation(options) {
    var image = {
      img: options.img,
      x: 0,
      y: 0,
      width: options.width,
      height: options.height,
      deg: 0,
      flip: true,
      ctx: options.ctx
    };
    switch (options && options.orientation) {
      case 3:
        // rotateImage180
        image.deg = 180;
        image.flip = false;
        break;
      case 4:
        image.deg = 180;
        image.flip = true;
        break;
      case 5:
        // rotate90AndFlipImage
        image.deg = 270;
        image.flip = true;
        break;
      case 6:
        // rotateImage90
        image.deg = 270;
        image.flip = false;
        break;
      case 7:
        // rotateNeg90AndFlipImage
        image.deg = 90;
        image.flip = true;
        break;
      case 8:
        // rotateNeg90
        image.deg = 90;
        image.flip = false;
        break;
    }
    this.drawImage(image);
  },

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
        if (file && file.image && file.image.orientation && file.image.orientation !== 1) {
          this.setImageOrientation({orientation: file.image.orientation, img, width: dimensions.width, height: dimensions.height, ctx});
        }
        else {
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
        }


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
