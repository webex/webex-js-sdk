const {wrap} = require('lodash');

/**
 * Wrapper around lodash.wrap which provides a means of retrieving the original
 * wrapped function.
 * @param {Function} fn
 * @param {mixed} args
 * @returns {Function}
 */
module.exports = function wrapUnwrap(fn, ...args) {
  const wrapped = wrap(fn, ...args);
  wrapped.unwrap = () => fn;
  return wrapped;
};
