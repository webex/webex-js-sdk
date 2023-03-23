import { Commands } from '@webex/cli-tools';

import { build, runTests } from './commands';

const main = () => {
  const commands = new Commands();

  commands.mount(build);
  commands.mount(runTests);

  commands.process();
};

main();
