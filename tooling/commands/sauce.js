module.exports = {
  command: `sauce`,
  desc: `Interact with sauce`,
  builder(yargs) {
    return yargs
      .options({
        'log-file': {
          default: `.sauce/sc.log`,
          description: `file from/to which to read/write the log for the sc binary. See the Sauce Connect docs for more details.`,
          type: `string`
        },
        'pid-file': {
          default: `.sauce/sc.pid`,
          description: `file from/to which to read/write the pid for the sc binary. See the Sauce Connect docs for more details.`,
          type: `string`
        },
        'ready-file': {
          default: `.sauce/sc.ready`,
          description: `file from/to which to read/write the ready for the sc binary. See the Sauce Connect docs for more details.`,
          type: `string`
        },
        'tid-file': {
          default: `.sauce/sc.tid`,
          description: `file from/to which to read/write the tid for the sc binary. See the Sauce Connect docs for more details.`,
          type: `string`
        }
      })
      .demandCommand(1)
      .commandDir(`./sauce`);
  }
};
