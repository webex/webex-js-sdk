/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* global Uint8Array, FileReader */

require('setimmediate');
var ExifImage = require('exif').ExifImage;

var ImageOrientationUtil = {
  getExifData: function getExifData(file, buf) {
    return new Promise(function setOrientation(resolve) {
      // For avatar images the file.type is set as image/jpeg, however for images shared in an activity file.mimeType is set as image/jpeg. Handling both conditions.
      if (file && file.image && (file.type === 'image/jpeg' || file.mimeType === 'image/jpeg')) {
        new ExifImage({image: buf}, function fetchExifData(error, exifData) {
          if (!error && exifData) {
            file.image.orientation = exifData.image.Orientation;
          }
          resolve(buf);
        }.bind(this));
      }
      else {
        resolve(buf);
      }
    }.bind(this));
  },

  fixImageOrientation: function fixImageOrientation(file) {
    return new Promise(function readFileInBuffer(resolve) {
      var reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = function onload() {
        var arrayBuffer = reader.result;
        var buf = new Buffer(arrayBuffer.byteLength);
        var view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < buf.length; ++i) {
          buf[i] = view[i];
        }
        resolve(buf);
      };
    }.bind(this))
      .then(function getExifData(buf) {
        return this.getExifData(file, buf);
      }.bind(this));
  },

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
  }


};

module.exports = ImageOrientationUtil;
