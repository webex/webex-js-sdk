/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-unused-vars: ["error", { "vars": "local" }] */
// eslint-disable-next-line no-redeclare

const {Buffer} = require('safe-buffer');
const {parse} = require('exifr/dist/lite.umd');

/**
 * Updates the image file with exif information, required to correctly rotate the image activity
 * @param {Object} file
 * @param {Object} options
 * @param {boolean} options.shouldNotAddExifData
 * @returns {Promise<Object>}
 */
export function updateImageOrientation(file, options = {}) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.readAsArrayBuffer(file);
    reader.onload = function onload() {
      const arrayBuffer = reader.result;
      const buf = Buffer.from(arrayBuffer);

      resolve(buf);
    };
  }).then((buf) => {
    if (options.shouldNotAddExifData) {
      return buf;
    }

    return readExifData(file, buf);
  });
}

/**
 * Adds exif orientation information on the image file
 * @param {Object} file
 * @param {Object} buf
 * @returns {Promise<ExifImage>}
 */
export async function readExifData(file, buf) {
  // For avatar images the file.type is set as image/jpeg, however for images shared in an activity file.mimeType is set as image/jpeg. Handling both conditions.
  if (file && (file.type === 'image/jpeg' || file.mimeType === 'image/jpeg')) {
    const exifData = await parse(buf, {translateValues: false});

    if (exifData) {
      const {Orientation, ExifImageHeight, ExifImageWidth} = exifData;

      file.orientation = Orientation;
      file.exifHeight = ExifImageHeight;
      file.exifWidth = ExifImageWidth;

      if (file.image) {
        file.image.orientation = Orientation;
      }
    }
  }

  return buf;
}

/* eslint-enable complexity */

export {default as processImage} from './process-image';
export {default as detectFileType} from './detect-filetype';
