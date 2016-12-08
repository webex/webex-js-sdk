import uuid from 'uuid';
import _ from 'lodash';

const FILE_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': `spreadsheet`,
  'application/pdf': `pdf`,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': `presentation`,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': `doc`,
  'application/vnd.ms-excel': `spreadsheet`,
  'application/octet-stream': `binary`,
  'application/zip': `zip`
};


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

export function constructFiles(files) {
  const constructedFiles = [];
  for (let i = 0; i < files.length; i++) {
    constructedFiles.push(constructFile(files[i]));
  }
  return constructedFiles;
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

export function getFileType(mimeType) {
  if (FILE_TYPES[mimeType]) {
    return FILE_TYPES[mimeType];
  }
  if (mimeType) {
    const tokens = mimeType.split(`/`);
    if (tokens[0] === `image`) {
      return `image`;
    }
    else if (tokens[0] === `text`) {
      return `${tokens[1].charAt(0).toUpperCase()}${tokens[1].slice(1)} file`;
    }
  }
  return `file`;
}
