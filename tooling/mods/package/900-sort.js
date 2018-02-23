

const {difference} = require('lodash');

module.exports = function sortPackageJson(pkg) {
  const order = [
    'name',
    'version',
    'description',
    'keywords',
    'homepage',
    'bugs',
    'license',
    'author',
    'contributors',
    'files',
    'main',
    'browser',
    'module',
    'bin',
    'man',
    'directories',
    'directories.lib',
    'directories.bin',
    'directories.man',
    'directories.doc',
    'directories.example',
    'repository',
    'scripts',
    'config',
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'bundledDependencies',
    'optionalDependencies',
    'engines',
    'engineString',
    'os',
    'cpu',
    'preferGlobal',
    'private',
    'publishConfig',
    'browser',
    'browserify'
  ];

  let result = order.reduce((acc, key) => {
    acc[key] = pkg[key];
    return acc;
  }, {});

  const unknownKeys = difference(Object.keys(pkg), order);

  result = unknownKeys.reduce((acc, key) => {
    acc[key] = pkg[key];
    return acc;
  }, result);

  return Promise.resolve(result);
};
