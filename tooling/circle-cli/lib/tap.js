'use strict';

module.exports = function tap(fn) {
  return (r) => new Promise((resolve) => {
    resolve(fn(r));
  })
    .then(() => r)
    .catch(() => r);
};
