/**
 *
 * Grabbed from https://github.com/feross/is-buffer/blob/master/index.js => es6 + prettier
 *
 * @param {buffer} buffer
 * @returns {boolean}
 */
export default (buffer) =>
  buffer != null &&
  buffer.constructor != null &&
  typeof buffer.constructor.isBuffer === 'function' &&
  buffer.constructor.isBuffer(buffer);
