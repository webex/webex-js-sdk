/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {stat} = require(`fs-promise`);
const denodeify = require(`denodeify`);

exports.rimraf = denodeify(require(`rimraf`));
exports.glob = denodeify(require(`glob`));
exports.mkdirp = denodeify(require(`mkdirp`));
exports.transformFile = denodeify(require(`babel-core`).transformFile);
exports.exec = denodeify(require(`child_process`).exec);

exports.exists = async function exists(filename) {
  try {
    await stat(filename);
    return true;
  }
  catch (err) {
    return false;
  }
};
