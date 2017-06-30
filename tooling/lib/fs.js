const path = require('path');

const debug = require('debug')('tooling:lib:fs');
const {access, constants} = require('fs-promise');


exports.exists = exists;

/**
 * Determine if the specified file exists
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function exists(filename) {
  if (!filename.startsWith('/')) {
    filename = path.resolve(process.cwd(), filename);
  }

  try {
    debug(`checking ${filename}`);
    await access(filename, constants.F_OK);
    debug(`found ${filename}`);
    return true;
  }
  catch (err) {
    debug(`did not find ${filename}`);
    return false;
  }
}
