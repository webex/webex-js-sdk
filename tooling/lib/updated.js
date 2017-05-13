'use strict';

const debug = require(`debug`)(`tooling:updated`);
const Git = require(`nodegit`);
const kit = require(`nodegit-kit`);
const _ = require(`lodash`);
const {read} = require(`../util/package`);
const {list} = require(`../lib/package`);
const {exec} = require(`./async`);
const {listDependents} = require(`./dependencies`);

exports.diff = async function diff(tag) {
  debug(`opening repo`);
  const repo = await Git.Repository.open(`${process.cwd()}/.git`);
  debug(`diffing HEAD against ${tag}`);
  const d = await kit.diff(repo, `HEAD`, tag);
  return d;
};

/**
 * Returns the dist-tag for the specified package
 * @param {string} packageName
 * @private
 * @returns {Promise<string>}
 */
async function getDistTag(packageName) {
  const pkg = await read(packageName);
  if (!pkg.private) {
    debug(`fetching dist-tag for ${packageName}`);
    try {
      const dt = await exec(`npm dist-tag ls ${packageName}`);
      if (!dt) {
        debug(`no dist-tags found for ${packageName}`);
        return undefined;
      }
      const tags = dt
        .split(`\n`)
        .map((d) => d.split(`:`))
        .reduce((acc, [tag, version]) => {
          acc[tag] = version;
          return acc;
        }, {});
      debug(`${packageName} is published as version ${tags.latest}`);
      return tags.latest;
    }
    catch (err) {
      // ignore 404s; they're normal for new packages
      if (!/npm ERR! 404 Registry returned 404 for GET on/.test(err)) {
        debug(`error occurred for ${packageName}`, err);
        throw err;
      }
      debug(`received 404 for ${packageName}, skipping`);
    }
  }
  return undefined;

}

/**
 * Determines the latest published package version for the repo
 * @returns {Promise<string>}
 */
exports.getNpmLatest = async function getNpmLatest() {
  const packages = Array.from(await list());
  const version = _(await Promise.all(packages
    .map(getDistTag)))
    .sort()
    .filter()
    .last()
    .trim();

  const tag = `v${version}`;
  return tag;
};

/**
 * Lists all of the udpated packages in the repo
 * @param {Object} options
 * @param {boolean} options.dependents
 * @param {boolean} options.npm
 * @param {boolean} options.upstream
 * @returns {Promise<Arra<string>>}
 */
exports.updated = async function updated({dependents, npm}) {
  const tag = npm ? await exports.getNpmLatest() : `upstream/master`;
  const changedPackages = _(await exports.diff(tag))
    .map((d) => d.path)
    .map(fileToPackage)
    .filter()
    .uniq()
    .value();

  if (dependents) {
    let transitive = new Set([...changedPackages]);
    for (const packageName of changedPackages) {
      transitive = new Set([...transitive, ...await listDependents(packageName, {includeTransitive: true})]);
    }
  }

  return changedPackages;
};

/**
 * Determins the package to which a given file belongs. Includes the meta
 * packages "docs", "legacy", and "tooling"
 * @param {string} d
 * @private
 * @returns {string}
 */
function fileToPackage(d) {
  debug(d);
  if (d.startsWith(`packages/node_modules/`)) {
    d = d.replace(`packages/node_modules/`, ``);
    d = d.split(`/`);
    if (d[0].startsWith(`@`)) {
      return d.slice(0, 2).join(`/`);
    }
    return d[0];
  }

  if (d.startsWith(`docs`)) {
    return `docs`;
  }

  if (d.startsWith(`src`) || d.startsWith(`test`)) {
    return `legacy`;
  }

  return `tooling`;
}
