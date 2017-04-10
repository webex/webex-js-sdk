#!/usr/bin/env node

/* eslint global-require: [0] */
/* eslint no-sync: [0] */
/* eslint require-jsdoc: [0] */

// Idealy, this file belongs in ./tooling, but the first iteration is a *lot*
// simpler if we don't have to deal with adding `../` to every file operation.

// Reminder: because this script uses the package.jsons in
// packages/node_modules, it should be used *after* new versions have been
// determined by babel.

// DO NOT COPY THIS FILE INTO THE react-ciscospark REPO.
// Instead, make it a package in its own right and let the react-ciscospark
// project depend on it.

const builtins = require(`builtins`);
const denodeify = require(`denodeify`);
const detective = require(`detective`);
const fs = require(`fs`);
const {curry, uniq} = require(`lodash`);
const path = require(`path`);
const rpj = require(`read-package-json`);
const _ = require(`lodash`);

const readPackage = denodeify(rpj);

function findDepsForPackage(packagePath) {
  return readPackage(packagePath)
   .then((pkg) => {
     let paths = [];

     if (pkg.main) {
       paths.push(path.resolve(path.dirname(packagePath), pkg.main));
     }

     if (paths.length === 0) {
       try {
         const p = path.resolve(path.dirname(packagePath), `index.js`);
         fs.statSync(p);
       }
       catch (err) {
         if (err.code !== `ENOENT`) {
           throw err;
         }
       }
     }

     if (pkg.bin) {
       paths = paths.concat(_.values(pkg.bin));
     }

     if (pkg.browser) {
       paths = paths.concat(_.values(pkg.browser).filter((p) => p));
     }

     return paths.reduce((acc, bin) => acc.concat(walkDeps(path.resolve(path.dirname(packagePath), bin))), []);
   })
   .catch((err) => {
     if (err.code === `EISDIR`) {
       return findDepsForPackage(path.join(packagePath, `package.json`));
     }

     throw err;
   });
}

const depsToVersions = curry((rootPkg, deps) => deps.reduce((acc, dep) => {
  if (builtins.includes(dep)) {
    return acc;
  }
  acc[dep] = rootPkg.dependencies[dep] || rootPkg.devDependencies[dep] || rootPkg.optionalDependencies[dep];
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

const assignDeps = curry((pkgPath, deps) => {
  if (!pkgPath.startsWith(`./`) && !pkgPath.startsWith(`/`)) {
    pkgPath = `./${pkgPath}`;
  }
  const pkg = require(pkgPath);
  pkg.dependencies = deps;

  // This next little bit has nothing to do with dependencies, but makes it a
  // whole lot easier to run tests
  // eslint-disable-next-line
  delete pkg.browserify;

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
});

const visited = new Set();
function walkDeps(filePath) {
  if (visited.has(filePath)) {
    return [];
  }
  try {
    visited.add(filePath);
    const requires = detective(fs.readFileSync(filePath));
    const deps = requires.reduce((acc, dep) => {
      if (dep.startsWith(`.`)) {
        acc = acc.concat(walkDeps(path.resolve(path.dirname(filePath), dep)));
      }
      else {
        acc.push(dep);
      }
      return acc;
    }, []);
    return uniq(deps.map((d) => {
      // The following block makes sure the dep is a package name and not a file
      // reference. Given a require of `@scope/foo/bar/baz`, the following will
      // return `@scope/foo`. Given a require of `foo/bar/baz`, the folling will
      // return `foo`.
      d = d.split(`/`);
      if (d[0].startsWith(`@`)) {
        return d.slice(0, 2).join(`/`);
      }
      return d[0];
    }));
  }
  catch (err) {
    if (err.code === `EISDIR`) {
      return walkDeps(path.resolve(filePath, `index.js`));
    }
    if (err.code === `ENOENT` && !filePath.endsWith(`.js`)) {
      return walkDeps(`${filePath}.js`);
    }
    throw err;
  }
}

function updateSinglePackage(packagePath) {
  return findDepsForPackage(packagePath)
    .then(depsToVersions(require(`./package.json`)))
    .then(assignDeps(path.join(packagePath, `package.json`)));
}

function findPackages(p) {
  return fs.readdirSync(p).reduce((acc, d) => {
    const fullpath = path.resolve(p, d);
    if (fs.statSync(fullpath).isDirectory()) {
      try {
        fs.statSync(path.resolve(fullpath, `package.json`));
        acc.push(fullpath);
      }
      catch (err) {
        if (err.code === `ENOENT`) {
          return acc.concat(findPackages(fullpath));
        }
        throw err;
      }
    }
    return acc;
  }, []);
}

function updateAllPackages(rootPath) {
  const paths = findPackages(rootPath)
    // The next line can be removed once the widget code is removed from this
    // repository
    .filter((p) => !p.includes(`widget`));
  return Promise.all(paths.map(updateSinglePackage));
}

if (require.main === module) {
  if (process.argv[2] === `--help`) {
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log(`usage: node deps.js [packagepath]`);
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log(`update dependency lists for all packages in ${__dirname}/packages/node_modules`);
    // eslint-disable-next-line no-console
    console.log(`\tnode deps.js`);
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log(`update dependency list for single package "ciscospark"`);
    // eslint-disable-next-line no-console
    console.log(`\tnode deps.js ./packages/node_modules/ciscospark`);
    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }

  let p;
  if (process.argv[2]) {
    p = updateSinglePackage(process.argv[2]);
  }
  else {
    p = updateAllPackages(path.resolve(__dirname, `./packages/node_modules`));
  }
  p.catch((err) => {
      // eslint-disable-next-line no-console
    console.error(err);
      // eslint-disable-next-line no-process-exit
    process.exit(64);
  });
}
else {
  module.exports = {
    assignDeps,
    depsToVersions,
    findDepsForPackage,
    findPackages,
    updateSinglePackage
  };
}
