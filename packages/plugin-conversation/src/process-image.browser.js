/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {pick} from 'lodash';
import {base64} from '@ciscospark/common';

/* global Blob, document, Image, URL */

/**
 * Determins the dimensions of an image
 * @param {Object} constraints
 * @param {Number} constraints.width
 * @param {Number} constraints.height
 * @param {Number} maxWidth
 * @param {Number} maxHeight
 * @returns {Object}
 */
export function computeDimensions({width, height}, maxWidth, maxHeight) {
  if (height > width) {
    if (height > maxHeight) {
      height = width * maxHeight / height;
      width = maxHeight;
    }

    if (width > maxWidth) {
      height = height * maxWidth / width;
      width = maxWidth;
    }
  }
  else {
    if (width > maxWidth) {
      height = height * maxWidth / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = width * maxHeight / height;
      height = maxHeight;
    }
  }

  return {height, width};
}

/**
 * Draws the image on the canvas so that the thumbnail
 * could be generated
 * @param {Object} options
 * @returns {Object}
 */
export function drawImage(options) {
  // save current context before applying transformations
  options.ctx.save();
  let rad;
  // convert degrees to radians
  if (options.flip) {
    rad = options.deg * Math.PI / 180;
  }
  else {
    rad = 2 * Math.PI - options.deg * Math.PI / 180;
  }
  // set the origin to the center of the image
  options.ctx.translate(options.x + options.width / 2, options.y + options.height / 2);
  // rotate the canvas around the origin
  options.ctx.rotate(rad);
  if (options.flip) {
    // flip the canvas
    options.ctx.scale(-1, 1);
  }
  // draw the image
  options.ctx.drawImage(options.img, -options.width / 2, -options.height / 2, options.width, options.height);
  // restore the canvas
  options.ctx.restore();
}

/**
 * Rotates/flips the image on the canvas as per exif information
 * @param {Object} options
 * @returns {Object}
 */
export function setImageOrientation(options) {
  const image = {
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
    // rotate180AndFlipImage
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
  default:
    break;
  }
  drawImage(image);
}

/**
 * Measures an image file and produces a thumbnail for it
 * @param {Object} options
 * @param {Blob|ArrayBuffer} options.file
 * @param {Number} options.thumbnailMaxWidth
 * @param {Number} options.thumbnailMaxHeight
 * @param {Boolean} options.enableThumbnails
 * @returns {Promise<Array>} Buffer, Dimensions, thumbnailDimensions
 */
export default function processImage({file, thumbnailMaxWidth, thumbnailMaxHeight, enableThumbnails}) {
  if (!file.type.startsWith(`image`)) {
    return Promise.resolve();
  }

  file = file instanceof Blob ? file : new Blob([file]);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function onload() {
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  })
    .then((img) => {
      const fileDimensions = pick(img, `height`, `width`);
      if (!enableThumbnails) {
        return [null, fileDimensions, null];
      }
      const thumbnailDimensions = computeDimensions(fileDimensions, thumbnailMaxWidth, thumbnailMaxHeight);

      const canvas = document.createElement(`canvas`);
      canvas.width = thumbnailDimensions.width;
      canvas.height = thumbnailDimensions.height;

      const ctx = canvas.getContext(`2d`);
      if (file && file.image && file.image.orientation && file.image.orientation !== 1) {
        setImageOrientation({orientation: file.image.orientation, img, width: thumbnailDimensions.width, height: thumbnailDimensions.height, ctx});
      }
      else {
        ctx.drawImage(img, 0, 0, thumbnailDimensions.width, thumbnailDimensions.height);
      }
      const parts = canvas.toDataURL(`image/png`).split(`,`);
      const byteString = base64.decode(parts[1]);

      const buffer = new ArrayBuffer(byteString.length);
      const view = new DataView(buffer);
      for (let i = 0; i < byteString.length; i++) {
        view.setUint8(i, byteString.charCodeAt(i));
      }

      return [buffer, fileDimensions, thumbnailDimensions];
    });
}
