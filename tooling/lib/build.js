/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require(`debug`)(`tooling:build`);
const {
  mkdirp,
  transformFile
} = require(`../lib/async`);
const path = require(`path`);
const {writeFile} = require(`fs-promise`);
const {glob} = require(`../util/package`);

exports.buildFile = async function buildFile({src, dest}) {
  debug(`transforming ${src}`);
  const {code, map} = await transformFile(src);
  debug(`transformFileed ${src}`);
  await mkdirp(path.dirname(dest));
  debug(`writing ${dest}`);
  await writeFile(dest, code);
  await writeFile(`${dest}.map`, JSON.stringify(map));
  debug(`wrote ${dest}`);
};

exports.buildPackage = async function buildPackage(packageName) {
  debug(`building package ${packageName}`);
  const files = await glob(`src/**/*.js`, {packageName});
  debug(`building files `, files);
  const mapped = files
  .map((filename) => path.join(`packages`, `node_modules`, packageName, filename))
  .map((filename) => ({
    src: filename,
    dest: filename.replace(`src`, `dist`)
  }));

  for (const file of mapped) {
    await exports.buildFile(file);
  }
};
