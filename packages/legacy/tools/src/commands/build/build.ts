import type { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import type { PackageBuildConfig } from '../../models';

import CONSTANTS from './build.constants';

/**
 * The build Command configuration Object. This Command is used to build legacy
 * packages within this project.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const build = require('./relative/path/build.js');
 *
 * const commands = new Commands();
 * commands.mount(build);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const build: CommandsCommand<PackageBuildConfig> = {
  /**
   * Configuration Object for this build Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles building legacy packages based on the provided Options from a
   * Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: PackageBuildConfig) => {
    const pack = new Package();

    return pack.build(options)
      .then(() => undefined);
  },
};

export default build;
