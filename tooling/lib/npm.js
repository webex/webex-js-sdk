'use strict';

const debug = require(`debug`)(`tooling:npm`);
const {read} = require(`../util/package`);
const {exec} = require(`./async`);

/**
 * Returns the dist-tag for the specified package
 * @param {string} packageName
 * @private
 * @returns {Promise<string>}
 */
exports.getDistTag = async function getDistTag(packageName) {
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
};
