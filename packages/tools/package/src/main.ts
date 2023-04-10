import { Commands } from '@webex/cli-tools';

import { increment, list, scripts } from './commands';

/**
 * Main CLI execution workflow initializer.
 *
 * @internal
 */
const main = () => {
  const commands = new Commands();

  commands.mount(increment);
  commands.mount(list);
  commands.mount(scripts);

  commands.process();
};

main();
