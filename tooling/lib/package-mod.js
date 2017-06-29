'use strict';

const debug = require(`debug`)(`tooling:lib:mod:package`);
const {read, write} = require(`../util/package`);
const path = require(`path`);
const requireDir = require(`require-dir`);

/**
 * Applies $mod to the specifed package's package.json
 * @param {Function} mod
 * @param {string} packageName
 * @returns {Promise}
 */
async function apply(mod, packageName) {
  let pkg = await read(packageName);
  pkg = await mod(pkg);
  await write(packageName, pkg);
}

/**
 * Loads all the mods in the specified directory and turns them into a single
 * function
 * @param {string} dir
 * @returns {Function}
 */
function combineMods(dir) {
  const mods = requireDir(dir);
  return async(pkg) => {
    for (const key of Object.keys(mods)) {
      debug(`applying transform ${key} to ${pkg.name}`);
      const mod = mods[key];
      pkg = await mod(pkg);
    }
    return pkg;
  };
}

/**
 * Applies the specified mod or directory of mods to the specified package
 * @param {Object} options
 * @param {string} options.dir
 * @param {string} options.mod
 * @param {string} options.packageName
 * @returns {Promise}
 */
exports.modPackage = async function modPackage({dir, mod, packageName}) {
  if (typeof mod === `string`) {
    if (!mod.startsWith(`/`)) {
      mod = path.resolve(process.cwd(), mod);
    }

    // eslint-disable-next-line global-require
    mod = require(mod);
  }

  if (!mod && dir) {
    mod = combineMods(dir);
  }

  if (!mod) {
    throw new Error(`one of 'mod' or 'dir' is required`);
  }

  apply(mod, packageName);
};
