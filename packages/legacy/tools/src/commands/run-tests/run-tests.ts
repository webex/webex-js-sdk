import type { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import type { PackageTestConfig } from '../../models';

import CONSTANTS from './run-tests.constants';

/**
 * The run-tests Command configuration Object. This Command is used to test legacy
 * packages within this project.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const runTests = require('./relative/path/run-tests.js');
 *
 * const commands = new Commands();
 * commands.mount(runTests);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const runTests: CommandsCommand<PackageTestConfig> = {
  /**
   * Configuration Object for this run-tests Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles testing legacy packages based on the provided Options from a
   * Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: PackageTestConfig) => {
    const pack = new Package();

    return pack.test(options)
      .then(() => undefined);
  },
};

export default runTests;
