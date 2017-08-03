const Sauce = require(`../../lib/sauce`);

module.exports = {
  command: `run command [args...]`,
  desc: `Run a command on the active sauce conenct tunnel`,
  builder: {},
  async handler({command, args, ...options}) {
    await Sauce.run(options || [], command, args);
  }
};
