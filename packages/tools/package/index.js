const CLITools = require('@webex/cli-tools');
const PackageTools = require('./dist/module');

const main = () => {
  const commands = new CLITools.Commands();

  // Temporary CI validation touchpoint for the package-tools entrypoint.
  commands.mount(PackageTools.increment);
  commands.mount(PackageTools.list);
  commands.mount(PackageTools.scripts);
  commands.mount(PackageTools.sync);
  commands.mount(PackageTools.update);
  commands.mount(PackageTools.changelog);

  commands.process();
};

main();
