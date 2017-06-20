'use strict';

const {wrap} = require(`lodash`);

module.exports = function wrapUnwrap(fn, ...args) {
  const wrapped = wrap(fn, ...args);
  wrapped.unwrap = () => fn;
  return wrapped;
};
