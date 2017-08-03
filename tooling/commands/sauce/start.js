const wrapHandler = require(`../../lib/wrap-handler`);
const Sauce = require(`../../lib/sauce`);

module.exports = {
  command: `start`,
  desc: `Start a Sauce Connect tunnel`,
  builder: {},
  handler: wrapHandler(async (argv) => {
    await Sauce.start(argv);
  })
};
