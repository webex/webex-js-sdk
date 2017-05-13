'use strict';

module.exports = {
  command: `version`,
  desc: `Work with version`,
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir(`./version`);
  }
};
