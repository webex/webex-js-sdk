#!/usr/bin/env node

/* eslint-disable complexity */
/* eslint-disable global-require */
/* eslint-disable no-sync */
/* eslint-disable require-jsdoc */
/* eslint-disable import/no-dynamic-require */

// Idealy, this file belongs in ./tooling, but the second iteration is a *lot*
// simpler if we don't have to deal with adding `../` to every file operation.

// Reminder: because this script uses the package.jsons in
// packages/node_modules, it should be used *after* new versions have been
// determined by babel.

// DO NOT COPY THIS FILE INTO THE react-ciscospark REPO.
// Instead, make it a package in its own right and let the react-ciscospark
// project depend on it.

const debug = require('debug')('deps');
const builtins = require('builtins')();
const detective = require('detective');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const util = require('util');

const FILTERED_TRANSFORMS = ['babelify'];
const DEFAULT_TRANSFORMS = ['envify'];

const depsToVersions = _.curry((rootPkg, deps) => deps.reduce((acc, dep) => {
  if (builtins.includes(dep)) {
    return acc;
  }

  acc[dep] = _.get(rootPkg, `dependencies[${dep}]`) || _.get(rootPkg, `devDependencies[${dep}]`) || _.get(rootPkg, `optionalDependencies[${dep}]`);

  if (!acc[dep]) {
    try {
      acc[dep] = require(`./packages/node_modules/${dep}/package.json`).version;
    }
    catch (err) {
      // eslint-disable-next-line no-console
      console.warn(err);
      throw new Error(`Failed to determine version for ${dep}, Is it missing from package.json?`);
    }
  }

  return acc;
}, {}));

const assignDeps = _.curry((pkg, versionedDeps) => {
  pkg.dependencies = versionedDeps;
});

/**
 * Finds all the entry points (pkg.main, pkg.bin[], pkg.browser{}, etc) for a
 * given package
 * @param {Package} pkg
 * @param {string} pkgPath
 * @returns {Array<string>}
 */
const findEntryPoints = _.curry((pkg, pkgPath) => {
  try {
    let paths = [];

    if (pkg.main) {
      paths.push(path.resolve(path.dirname(pkgPath), pkg.main));
    }

    if (paths.length === 0) {
      try {
        const p = path.resolve(path.dirname(pkgPath), 'index.js');

        fs.statSync(p);
      }
      catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }

    if (pkg.bin) {
      paths = paths.concat(_.values(pkg.bin));
    }

    if (pkg.browser) {
      paths = paths.concat(_.values(pkg.browser).filter((p) => p && !p.startsWith('@')));
    }

    return paths;
  }
  catch (err) {
    if (err.code === 'EISDIR') {
      return findEntryPoints(pkg, path.join(pkgPath, 'package.json'));
    }

    throw err;
  }
});

const visited = new Set();
/**
 * Walks the require tree beginning with the file at filePath
 * @param {string} filePath
 * @returns {Array<string>}
 */
const findRequires = _.curry(function findRequires(filePath) {
  if (visited.has(filePath)) {
    return [];
  }
  try {
    visited.add(filePath);
    debug(`finding requires for ${filePath}`);
    const requires = detective(fs.readFileSync(filePath));

    debug(util.inspect(requires, {depth: null}));

    return requires.reduce((acc, dep) => {
      debug(`checking ${dep}`);
      if (dep.startsWith('.')) {
        debug(`descending into ${dep}`);
        acc = acc.concat(findRequires(path.resolve(path.dirname(filePath), dep)));
      }
      else {
        debug(`${dep} is a dependency for ${filePath}`);
        acc.push(dep);
      }

      return acc;
    }, []);
  }
  catch (err) {
    if (err.code === 'EISDIR') {
      return findRequires(path.resolve(filePath, 'index.js'));
    }
    if (err.code === 'ENOENT' && !filePath.endsWith('.js')) {
      return findRequires(`${filePath}.js`);
    }
    throw err;
  }
});

const entryPointsToRequires = _.curry((pkgPath, entryPoints) => entryPoints.reduce((acc, entryPoint) => acc.concat(findRequires(path.resolve(path.dirname(pkgPath), entryPoint))), []));

/**
 * Turns requires into package names and filters out non-unique entries
 * @param {Array<string>} requires
 * @returns {Array<string>}
 */
const requiresToDeps = _.curry((requires) => _.uniq(requires.map((d) => {
  // The following block makes sure the dep is a package name and not a file
  // reference. Given a require of `@scope/foo/bar/baz`, the following will
  // return `@scope/foo`. Given a require of `foo/bar/baz`, the folling will
  // return `foo`.
  d = d.split('/');
  if (d[0].startsWith('@')) {
    return d.slice(0, 2).join('/');
  }

  return d[0];
})));

const filterBrowserifyTransforms = _.curry((defaults, filtered, pkg) => {
  const transforms = _.get(pkg, 'browserify.transform', [])
    .reduce((acc, tx) => {
      if (_.isArray(tx)) {
        tx = tx[0];
      }

      if (!filtered.includes(tx)) {
        acc.push(tx);
      }

      return acc;
    }, []);

  _.set(pkg, 'browserify.transform', _.uniq(transforms.concat(defaults)));

  return pkg;
});

/**
 * Reads the packages list of browserify transforms and adds all as
 * dependencies, except for those in FILTERED_TRANSFORMS
 * @param {Package} pkg
 * @param {Array<string>} requires
 * @returns {Array<string>}
 */
const appendBrowserifyTransforms = _.curry((pkg, requires) => requires.concat(pkg.browserify.transform.reduce((acc, tx) => {
  if (_.isArray(tx)) {
    tx = tx[0];
  }

  acc.push(tx);

  return acc;
}, [])));


const writeFile = _.curry((pkgPath, pkg) => {
  if (!pkg) {
    throw new Error(`Cannot write empty pkg to ${pkgPath}`);
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
});

function findPkgPath(pkgPath) {
  if (pkgPath.endsWith('package.json')) {
    return pkgPath;
  }

  try {
    const filePath = `${pkgPath}.json`;

    fs.statSync(filePath);

    return filePath;
  }
  catch (err) {
    const dirPath = path.resolve(pkgPath, 'package.json');

    fs.statSync(dirPath);

    return dirPath;
  }
}

/**
 * Modifies a single package.json
 * @param {string} rootPkgPath
 * @param {string} pkgPath
 * @returns {Promise}
 */
const updateSinglePackage = _.curry((rootPkgPath, pkgPath) => {
  debug(`\n\nFinding dependencies for package ${pkgPath}\n\n`);
  rootPkgPath = findPkgPath(rootPkgPath);
  pkgPath = findPkgPath(pkgPath);

  const rootPkg = require(rootPkgPath);
  const pkg = require(pkgPath);

  return Promise.resolve(filterBrowserifyTransforms(DEFAULT_TRANSFORMS, FILTERED_TRANSFORMS, pkg))
    .then(() => findEntryPoints(pkg, pkgPath))
    .then(entryPointsToRequires(pkgPath))
    .then(requiresToDeps)
    .then(appendBrowserifyTransforms(pkg))
    .then(depsToVersions(rootPkg))
    .then(assignDeps(pkg))
    .then(() => writeFile(pkgPath, pkg))
    .catch((err) => {
      debug(`failed at package ${pkgPath}`);
      throw err;
    });
});

/**
 * Locates all packages below the specified directory
 * @param {string} packagesPath
 * @returns {Array<string>}
 */
function findPackages(packagesPath) {
  return fs.readdirSync(packagesPath).reduce((acc, d) => {
    const fullpath = path.resolve(packagesPath, d);

    if (fs.statSync(fullpath).isDirectory()) {
      try {
        fs.statSync(path.resolve(fullpath, 'package.json'));
        acc.push(fullpath);
      }
      catch (err) {
        if (err.code === 'ENOENT') {
          return acc.concat(findPackages(fullpath));
        }
        throw err;
      }
    }

    return acc;
  }, []);
}

/**
 * Transforms all packages
 * @param {string} rootPkgPath
 * @param {string} packagesPath
 * @returns {Promise}
 */
function updateAllPackages(rootPkgPath, packagesPath) {
  const paths = findPackages(packagesPath);

  return paths.reduce((promise, pkgPath) => promise.then(() => updateSinglePackage(rootPkgPath, pkgPath)), Promise.resolve());
}

if (require.main === module) {
  if (process.argv[2] === '--help') {
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log('usage: node deps.js [packagepath]');
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log(`update dependency lists for all packages in ${__dirname}/packages/node_modules`);
    // eslint-disable-next-line no-console
    console.log('\tnode deps.js');
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log('update dependency list for single package "ciscospark"');
    // eslint-disable-next-line no-console
    console.log('\tnode deps.js ./packages/node_modules/ciscospark');
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }

  const rootPkgPath = path.resolve(process.cwd(), 'package.json');
  let p;

  if (process.argv[2]) {
    p = updateSinglePackage(rootPkgPath, process.argv[2]);
  }
  else {
    p = updateAllPackages(rootPkgPath, path.resolve(process.cwd(), './packages/node_modules'));
  }
  p.catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    // eslint-disable-next-line no-console
    console.error(err.stack);
    // eslint-disable-next-line no-process-exit
    process.exit(64);
  });
}
else {
  module.exports = {
    depsToVersions,
    assignDeps,
    findEntryPoints,
    findRequires,
    entryPointsToRequires,
    requiresToDeps,
    appendBrowserifyTransforms,
    writeFile,
    updateSinglePackage,
    updateAllPackages
  };
}
