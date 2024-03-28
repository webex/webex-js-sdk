/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {pick} from 'lodash';

import {orient} from './orient';
/* eslint-env browser */

/**
 * Determins the dimensions of an image
 * @param {Object} constraints
 * @param {Number} constraints.width
 * @param {Number} constraints.height
 * @param {Number} maxWidth
 * @param {Number} maxHeight
 * @returns {Object}
 */
function computeDimensions({width, height}, maxWidth, maxHeight) {
  if (height > width) {
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
  } else {
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }
  }

  return {height, width};
}

/**
 * Measures an image file and produces a thumbnail for it
 * @param {Object} options
 * @param {Blob|ArrayBuffer} options.file
 * @param {Number} options.thumbnailMaxWidth
 * @param {Number} options.thumbnailMaxHeight
 * @param {Boolean} options.enableThumbnails
 * @param {Object} options.logger
 * @param {Boolean} options.isAvatar
 * @returns {Promise<Array>} Buffer, Dimensions, thumbnailDimensions
 */
export default function processImage({
  file,
  type,
  thumbnailMaxWidth,
  thumbnailMaxHeight,
  enableThumbnails,
  logger,
  isAvatar,
}) {
  if (!type || !type.startsWith('image')) {
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
  }).then((img) => {
    const fileDimensions = pick(img, 'height', 'width');

    if (isAvatar) {
      // only if image is a profile avatar
      logger.info('dimensions will be set for avatar image');
      const size =
        fileDimensions.height > fileDimensions.width ? fileDimensions.height : fileDimensions.width;

      fileDimensions.height = size;
      fileDimensions.width = size;
    }
    if (!enableThumbnails) {
      logger.info('thumbnails not enabled');

      return [null, fileDimensions, null];
    }
    const thumbnailDimensions = computeDimensions(
      fileDimensions,
      thumbnailMaxWidth,
      thumbnailMaxHeight
    );

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const {width, height} = thumbnailDimensions;

    // explanation of orientation:
    // https://stackoverflow.com/questions/20600800/js-client-side-exif-orientation-rotate-and-mirror-jpeg-images
    if (file.orientation && file.orientation > 4) {
      canvas.width = height;
      canvas.height = width;
      thumbnailDimensions.width = height;
      thumbnailDimensions.height = width;
    } else {
      canvas.width = thumbnailDimensions.width;
      canvas.height = thumbnailDimensions.height;
    }

    orient(
      {
        orientation: file && file.orientation ? file.orientation : '',
        img,
        x: 0,
        y: 0,
        width,
        height,
        ctx,
      },
      file
    );

    const parts = canvas.toDataURL('image/png').split(',');
    // Thumbnail uploads were failing with common/base64 decoding
    const byteString = atob(parts[1]);

    const buffer = new ArrayBuffer(byteString.length);
    const view = new DataView(buffer);

    for (let i = 0; i < byteString.length; i += 1) {
      view.setUint8(i, byteString.charCodeAt(i));
    }

    return [buffer, fileDimensions, thumbnailDimensions];
  });
}
