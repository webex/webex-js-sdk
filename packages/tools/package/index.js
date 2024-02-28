const CLITools = require('@webex/cli-tools');
const PackageTools = require('./dist/module');

const main = () => {
  const commands = new CLITools.Commands();

  commands.mount(PackageTools.increment);
  commands.mount(PackageTools.list);
  commands.mount(PackageTools.scripts);
  commands.mount(PackageTools.sync);
  commands.mount(PackageTools.update);

  commands.process();
};

main();
