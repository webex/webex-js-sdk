/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import gm from 'gm';
import {pick} from 'lodash';

export default function processImage(file, thumbnailMaxWidth, thumbnailMaxHeight, logger) {
  if (!file.type || !file.type.startsWith(`image`)) {
    return Promise.resolve();
  }

  const fileDimensions = new Promise((resolve, reject) => {
    gm(file).size((err, size) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(pick(size, `width`, `height`));
    });
  });

  const thumbnail = new Promise((resolve, reject) => {
    gm(file).resize(thumbnailMaxWidth, thumbnailMaxHeight)
      .toBuffer((err, buffer) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(buffer);
      });
  });

  const thumbnailDimensions = thumbnail.then((buffer) => new Promise((resolve, reject) => {
    gm(buffer)
      .size((err, size) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(pick(size, `width`, `height`));
      });
  }));


  return Promise.all([thumbnail, fileDimensions, thumbnailDimensions])
    .catch((err) => {
      const errorString = err.toString();
      if (errorString.includes(`EPIPE`)) {
        logger.warn(err, `Is GraphicsMagick installed?`);
        return Promise.resolve();
      }

      if (errorString.indexOf(`No decode delegate for this image format`) !== -1) {
        logger.debug(err, `File does not appear to be an image`);
        return Promise.resolve();
      }

      if (errorString.indexOf(`Stream yields empty buffer`)) {
        logger.debug(err, `File does not appear to be an image`);
        return Promise.resolve();
      }

      return Promise.reject(err);
    });

}
