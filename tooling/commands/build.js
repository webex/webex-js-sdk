/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {list} = require(`../util/package`);
const {buildPackage} = require(`../lib/build`);

module.exports = {
  command: `build [packageName]`,
  desc: `Build one or all packages`,
  builder: {

  },
  async handler({packageName}) {
    if (packageName) {
      await buildPackage(packageName);
    }
    else {
      for (const pName of await list()) {
        await buildPackage(pName);
      }
    }
  }
};
