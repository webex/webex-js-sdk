const Sauce = require(`../../lib/sauce`);

module.exports = {
  command: `start`,
  desc: `Start a Sauce Connect tunnel`,
  builder: {},
  async handler(argv) {
    await Sauce.start(argv);
  }
};
