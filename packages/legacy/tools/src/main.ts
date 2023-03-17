import { Commands } from '@webex/cli-tools';

import { build } from './commands';

const main = () => {
  const commands = new Commands();

  commands.mount(build);

  commands.process();
};

main();
