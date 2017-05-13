'use strict';

module.exports = {
  command: `dependencies`,
  desc: `Work with dependencies`,
  builder(yargs) {
    return yargs
      .demandCommand()
      .commandDir(`./dependencies`);
  }
};
