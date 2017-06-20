'use strict';

const {defaults} = require(`lodash`);

module.exports = function addDefaults(pkg) {
  defaults(pkg, {
    engines: {
      node: `>=4`
    },
    license: `MIT`,
    repository: `https://github.com/ciscospark/spark-js-sdk/tree/master/packages/node_modules${pkg.name}`
  });

  return Promise.resolve(pkg);
};
