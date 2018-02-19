

module.exports = function addDefaults(pkg) {
  Object.assign(pkg, {
    engines: {
      node: '>=6'
    },
    license: 'MIT',
    repository: 'https://github.com/ciscospark/spark-js-sdk'
  });

  return Promise.resolve(pkg);
};
