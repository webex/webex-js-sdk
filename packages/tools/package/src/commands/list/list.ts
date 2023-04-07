import type { CommandsCommand } from '@webex/cli-tools';

import { Yarn } from '../../utils';
import type { YarnListPackage } from '../../utils';

import CONSTANTS from './list.constants';
import type { Options } from './list.types';

/**
 * The list Command configuration Object. This Command is used to list packages
 * based on the provided CLI Options.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const list = require('./relative/path/list.js');
 *
 * const commands = new Commands();
 * commands.mount(list);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const list: CommandsCommand<Options> = {
  /**
   * Configuration Object for this List Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles listing packages based on the provided Options from a
   * Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: Options) => Yarn.list({
    noPrivate: !options.private,
    recursive: options.recursive,
    since: options.since,
  })
    .then((packageDetails) => packageDetails.map(({ name }: YarnListPackage) => name))
    .then((packageNames: Array<string>) => {
      const output = `[${packageNames.map((packageName) => `"${packageName}"`).join(', ')}]`;
      process.stdout.write(output);
    }),
};

export default list;
