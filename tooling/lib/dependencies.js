'use strict';

const debug = require(`debug`)(`tooling:dependencies`);
const builtins = require(`builtins`);
const {read} = require(`../util/package`);
const path = require(`path`);
const {uniq, values} = require(`lodash`);
const detective = require(`detective`);
const fs = require(`fs`);

/**
 * Lists the dependencies of a given package
 * @param {string} packageName
 * @param {boolean} [includeTransient=true]
 * @param {boolean} [localOnly=false}]
 * @returns {Promise<Array<string>>}
 */
exports.list = async function list(packageName, {includeTransient = true, localOnly = false}) {
  const pkg = await read(packageName);
  const entrypoints = await listEntryPoints(pkg);

  let deps = findDeps(entrypoints);
  const localDeps = deps.filter((d) => d.startsWith(`@`));

  if (includeTransient) {
    for (const dep of localDeps) {
      deps = deps.concat(findDeps(listEntryPoints(dep)));
    }
  }

  if (localOnly) {
    deps.filter((d) => d.startsWith(`@`));
  }

  return deps;
};

/**
 * Lists the dependencies of a given package (with versions)
 * @param {string} packageName
 * @param {Object} options
 * @returns {Promise<Object>}
 */
exports.listVersions = async function listVersions(packageName, options) {
  const deps = await exports.list(packageName, options);
  // eslint-disable-next-line global-require
  const pkg = require(path.resolve(process.cwd(), `package.json`));

  return deps.reduce((acc, dep) => {
    acc[dep] = pkg.dependencies[dep] || pkg.devDependencies[dep] || pkg.optionalDependencies[dep];
    if (!acc[dep]) {
      try {
        // eslint-disable-next-line global-require
        acc[dep] = require(path.resolve(process.cwd(), `./packages/node_modules/${dep}/package.json`)).version;
      }
      catch (err) {
        // eslint-disable-next-line no-console
        debug(err);
        throw new Error(`Failed to determine version for ${dep}, Is it missing from package.json?`);
      }
    }
    return acc;
  }, {});
};

/**
 * Finds all the dependencies for a given set of entrypoints
 * @param {Array<string>} entrypoints
 * @returns {Array<string>}
 */
function findDeps(entrypoints) {
  let requires = [];
  for (const entrypoint of entrypoints) {
    requires = requires.concat(walk(entrypoint));
  }

  return uniq(requires
    .map((d) => {
      d = d.split(`/`);
      if (d[0].startsWith(`@`)) {
        return d.slice(0, 2).join(`/`);
      }
      return d[0];
    })
    .filter((d) => !builtins.includes(d))
    .sort());
}

/**
 * Finds all the entrypoints for the specified package
 * @param {Object} pkg
 * @returns {Array<string>}
 */
function listEntryPoints(pkg) {
  debug(`listing entrypoints for ${pkg.name}`);
  let paths = [];

  if (pkg.main) {
    debug(`found main path for ${pkg.name}`);
    paths.push(pkg.main);
  }

  if (pkg.bin) {
    debug(`found main bin entry(s) for ${pkg.name}`);
    paths = paths.concat(values(pkg.bin));
  }

  if (pkg.browser) {
    debug(`found main browser entry(s) for ${pkg.name}`);
    paths = paths.concat(values(pkg.browser).filter((p) => p && !p.startsWith(`@`)));
  }

  debug(paths);

  return paths
    .map((p) => path.resolve(`packages`, `node_modules`, pkg.name, p));
}


const visited = new Set();
/**
 * Finds all dependencies of entrypoint
 * @param {string} entrypoint
 * @returns {Array<string>}
 */
function walk(entrypoint) {
  try {
    if (visited.has(entrypoint)) {
      return [];
    }
    visited.add(entrypoint);
    debug(`finding requires for ${entrypoint}`);
    // This whole thing is *way* easier if we do it synchronously
    // eslint-disable-next-line no-sync
    const requires = detective(fs.readFileSync(entrypoint));
    return requires.reduce((acc, dep) => {
      debug(`found ${dep}`);
      if (dep.startsWith(`.`)) {
        debug(`${dep} is relative, descending`);
        acc = acc.concat(walk(path.resolve(path.dirname(entrypoint), dep)));
      }
      else {
        debug(`found dependency ${dep}`);
        acc.push(dep);
      }
      return acc;
    }, []);
  }
  catch (err) {
    if (err.code === `EISDIR`) {
      return walk(path.resolve(entrypoint, `index.js`));
    }
    if (err.code === `ENOENT` && !entrypoint.endsWith(`.js`)) {
      return walk(`${entrypoint}.js`);
    }
    throw err;
  }
}
