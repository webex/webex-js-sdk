import { Commands } from '@webex/cli-tools';

import {
  increment, list, scripts, sync,
} from './commands';

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
  commands.mount(sync);

  commands.process();
};

main();
