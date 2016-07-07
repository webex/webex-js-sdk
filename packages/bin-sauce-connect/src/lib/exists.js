import denodeify from 'denodeify';
import fs from 'fs';

const stat = denodeify(fs.stat);

/**
 * Determine if a file exists at the specified path
 * @param {string} filepath
 * @returns {Boolean}
 */
export default async function exists(filepath) {
  try {
    await stat(filepath);
    return true;
  }
  catch (reason) {
    return false;
  }
}
