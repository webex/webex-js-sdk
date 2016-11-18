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

    drawImage: function drawImage(img, x, y, width, height, deg, flip, ctx) {
      //save current context before applying transformations
      ctx.save();
      var rad;
      //convert degrees to radians
      if (flip) {
          rad = deg * Math.PI / 180;
      }
      else {
          rad = 2*Math.PI - deg * Math.PI / 180;
      }
      //set the origin to the center of the image
      ctx.translate(x + width/2, y + height/2);
      //rotate the canvas around the origin
      ctx.rotate(rad);
      if (flip) {
          //flip the canvas
          ctx.scale(-1,1);
      }
      //draw the image
      ctx.drawImage(img, -width/2, -height/2, width, height);
      //restore the canvas
      ctx.restore();
  },

  setImageOrientation: function setImageOrientation(orientation, img, width, height, ctx) {
    switch(orientation) {
      case 2:
        this.drawImage(img, 0, 0, width, height, 0, true, ctx); // flipImage
        break;
      case 3:
        this.drawImage(img, 0, 0, width, height, 180, false, ctx); // rotateImage180
        break;
      case 4:
        this.drawImage(img, 0, 0, width, height, 180, true, ctx); // rotate180AndFlipImage
        break;
      case 5:
        this.drawImage(img, 0, 0, width, height, 270, true, ctx); // rotate90AndFlipImage
        break;
      case 6:
        this.drawImage(img, 0, 0, width, height, 270, false, ctx); // rotateImage90
        break;
      case 7:
        this.drawImage(img, 0, 0, width, height, 90, true, ctx); // rotateNeg90AndFlipImage
        break;
      case 8:
        this.drawImage(img, 0, 0, width, height, 90, false, ctx); // rotateNeg90
        break;
    }

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
          this.setImageOrientation(file.image.orientation, img, dimensions.width, dimensions.height, ctx);
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
