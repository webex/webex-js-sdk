'use strict';

const _list = require(`../util/package`).list;

let packages;
exports.list = async function list() {
  if (!packages) {
    packages = new Set(await _list());
  }

  return packages;
};
