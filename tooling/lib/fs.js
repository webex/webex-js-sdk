'use strict';

const debug = require(`debug`)(`tooling:lib:fs`);
const {access} = require(`fs-promise`);
const fs = require(`fs-promise`);
const path = require(`path`);

exports.exists = exists;

/**
 * Determine if the specified file exists
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function exists(filename) {
  if (!filename.startsWith(`/`)) {
    filename = path.resolve(process.cwd(), filename);
  }

  try {
    debug(`checking ${filename}`);
    await access(filename, fs.constants.F_OK);
    debug(`found ${filename}`);
    return true;
  }
  catch (err) {
    debug(`did not find ${filename}`);
    return false;
  }
}
