import path from 'path';

import { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import { Yarn } from '../../utils';
import type { PackageConfig } from '../../models';

import CONSTANTS from './scripts.constants';
import type { Options } from './scripts.types';

/**
 * The scripts Command configuration Object. This Command is used to manage and
 * validate scripts within a provided package.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const scripts = require('./relative/path/scripts.js');
 *
 * const commands = new Commands();
 * commands.mount(scripts);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const scripts: CommandsCommand<Options> = {
  /**
   * Configuration Object for this Scripts Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles managing and validating package scripts based on the provided
   * Options from a Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: Options) => {
    const rootDir = process.cwd();

    return Yarn.list()
      .then((packageDetails) => packageDetails.map(({ location, name }: PackageConfig) => new Package({
        location: path.join(rootDir, location),
        name,
      })))
      .then((packs: Array<Package>) => packs.find((pack) => pack.name === options.package))
      .then((pack) => {
        if (!pack) {
          return Promise.resolve(false);
        }

        return pack.hasScript(options.script);
      })
      .then((results) => {
        process.stdout.write(`${results}`);

        return results;
      });
  },
};

export default scripts;
