/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

module.exports = {
  command: `version`,
  desc: `Work with version`,
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir(`./version`);
  }
};
