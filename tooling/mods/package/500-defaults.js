'use strict';

module.exports = function addDefaults(pkg) {
  Object.assign(pkg, {
    browserify: {
      transform: [
        `envify`
      ]
    },
    engines: {
      node: `>=6`
    },
    license: `MIT`,
    repository: `https://github.com/ciscospark/spark-js-sdk`
  });

  return Promise.resolve(pkg);
};
