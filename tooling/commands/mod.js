'use strict';

module.exports = {
  command: `mod`,
  desc: `Apply source transformations`,
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir(`./mod`);
  }
};
