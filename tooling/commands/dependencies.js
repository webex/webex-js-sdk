/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

module.exports = {
  command: `dependencies`,
  desc: `Work with dependencies`,
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir(`./dependencies`);
  }
};
