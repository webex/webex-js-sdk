import uuid from 'uuid';
import _ from 'lodash';

export function bytesToSize(bytes) {
  if (!bytes || bytes === 0) {
    return `0 Bytes`;
  }
  const k = 1000;
  const sizes = [`Bytes`, `KB`, `MB`, `GB`, `TB`, `PB`, `EB`, `ZB`, `YB`];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const output = (bytes / Math.pow(k, i)).toPrecision(3);
  return `${output} ${sizes[i]}`;
}

export function bufferToBlob(buffer) {
  const urlCreator = window.URL || window.webkitURL;
  const blob = new Blob([buffer], {type: buffer.type});
  const objectUrl = urlCreator.createObjectURL(blob);
  return {blob, objectUrl};
}

export function constructFile(file) {
  return _.assign(file, {
    clientTempId: uuid.v4(),
    displayName: file.name,
    fileSize: file.size,
    fileSizePretty: bytesToSize(file.size),
    mimeType: file.type
  });
}

export function constructImage(file) {
  if (!isImage(file)) {
    return Promise.resolve();
  }

  const objectURL = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function onload() {
      resolve(img);
    };
    img.onerror = reject;
    img.src = objectURL;
  })
    .then((img) => {
      const dimensions = _.pick(img, `height`, `width`);
      const image = {
        clientTempId: file.clientTempId,
        height: dimensions.height,
        width: dimensions.width,
        objectURL
      };

      return Promise.resolve(image);
    });
}

export function isImage(file) {
  return file.type.indexOf(`image`) !== -1;
}

export function sanitize(file) {
  return _.assign(file, {
    id: file.clientTempId,
    displayName: file.displayName || null,
    fileSize: file.fileSize || 0,
    fileSizePretty: bytesToSize(file.fileSize)
  });
}
