import { Commands } from '@webex/cli-tools';

import { increment, list } from './commands';

/**
 * Main CLI execution workflow initializer.
 *
 * @internal
 */
const main = () => {
  const commands = new Commands();

  commands.mount(increment);
  commands.mount(list);

  commands.process();
};

main();
