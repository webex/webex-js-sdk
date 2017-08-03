const Sauce = require(`../../lib/sauce`);
const wrapHandler = require(`../../lib/wrap-handler`);

module.exports = {
  command: `run command [args...]`,
  desc: `Run a command on the active sauce conenct tunnel`,
  builder: {},
  handler: wrapHandler(async ({command, args, ...options}) => {
    await Sauce.run(options || [], command, args);
  })
};
