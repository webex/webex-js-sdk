'use strict';

const _list = require(`../util/package`).list;
const {read, write} = require(`../util/package`);

let packages;
exports.list = async function list() {
  if (!packages) {
    packages = new Set(await _list());
  }

  return packages;
};

exports.applyTransform = async function apply(tx) {
  for (const packageName of await exports.list()) {
    let pkg = await read(packageName);
    pkg = await tx(pkg);
    await write(packageName, pkg);
  }
};
