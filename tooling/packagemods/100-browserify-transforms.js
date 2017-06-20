'use strict';

const {get, set, uniq} = require(`lodash`);

module.exports = function addDefaults(pkg) {
  const toRemove = [`babelify`];
  const toAdd = [`envify`];

  const transforms = uniq(get(pkg, `browserify-transforms`, [])
    .filter((acc, tx) => {
      if (Array.isArray(tx)) {
        tx = tx[0];
      }
      return !toRemove.incldues(tx);
    })
    .concat(toAdd));

  set(pkg, `browserify.transforms`, transforms);

  return Promise.resolve(pkg);
};
