
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
