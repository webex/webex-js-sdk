/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import gm from 'gm';
import {pick} from 'lodash';

/**
 * Measures an image file and produces a thumbnail for it
 * @param {Object} options
 * @param {Blob|ArrayBuffer} options.file
 * @param {Number} options.thumbnailMaxWidth
 * @param {Number} options.thumbnailMaxHeight
 * @param {Boolean} options.enableThumbnails
 * @param {Object} options.logger
 * @returns {Promise<Array>} Buffer, Dimensions, thumbnailDimensions
 */
export default function processImage({
  file,
  type,
  thumbnailMaxWidth,
  thumbnailMaxHeight,
  enableThumbnails,
  logger,
}) {
  const fileType = type || file.type;

  if (!fileType || !fileType.startsWith('image')) {
    return Promise.resolve();
  }

  const fileDimensions = new Promise((resolve, reject) => {
    gm(file).size((err, size) => {
      if (err) {
        reject(err);

        return;
      }

      resolve(pick(size, 'width', 'height'));
    });
  });

  let thumbnail;
  let thumbnailDimensions;

  if (enableThumbnails) {
    thumbnail = new Promise((resolve, reject) => {
      gm(file)
        .resize(thumbnailMaxWidth, thumbnailMaxHeight)
        .autoOrient()
        .toBuffer('PNG', (err, buffer) => {
          if (err) {
            reject(err);

            return;
          }

          resolve(buffer);
        });
    });

    thumbnailDimensions = thumbnail.then(
      (buffer) =>
        new Promise((resolve, reject) => {
          gm(buffer).size((err, size) => {
            if (err) {
              reject(err);

              return;
            }

            resolve(pick(size, 'width', 'height'));
          });
        })
    );
  }

  return Promise.all([thumbnail, fileDimensions, thumbnailDimensions]).catch((err) => {
    const errorString = err.toString();

    if (errorString.includes('EPIPE')) {
      logger.warn(err, 'Is GraphicsMagick installed?');

      return Promise.resolve();
    }

    if (errorString.includes('No decode delegate for this image format')) {
      logger.debug(err, 'File does not appear to be an image');

      return Promise.resolve();
    }

    if (errorString.includes('Stream yields empty buffer')) {
      logger.debug(err, 'File does not appear to be an image');

      return Promise.resolve();
    }

    return Promise.reject(err);
  });
}
