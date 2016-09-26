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
 * Measures an image file and produces a thumbnail for it
 * @param {Blob|ArrayBuffer} file
 * @param {Number} thumbnailMaxWidth
 * @param {Number} thumbnailMaxHeight
 * @returns {Promise<Array>} Buffer, Dimensions, thumbnailDimensions
 */
export default function processImage(file, thumbnailMaxWidth, thumbnailMaxHeight) {
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

      const thumbnailDimensions = computeDimensions(fileDimensions, thumbnailMaxWidth, thumbnailMaxHeight);

      const canvas = document.createElement(`canvas`);
      canvas.width = thumbnailDimensions.width;
      canvas.height = thumbnailDimensions.height;

      const ctx = canvas.getContext(`2d`);
      ctx.drawImage(img, 0, 0, thumbnailDimensions.width, thumbnailDimensions.height);

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
