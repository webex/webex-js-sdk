const Sauce = require(`../../lib/sauce`);

module.exports = {
  command: `stop`,
  desc: `Stop a running Sauce Connect tunnel`,
  builder: {
    pid: {
      description: `pid of Sauce Connect binary. If not specified, will read from pidFile`,
      type: `number`
    }
  },
  async handler(args) {
    await Sauce.stop(args);
  }
};
