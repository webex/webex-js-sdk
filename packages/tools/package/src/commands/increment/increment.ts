import path from 'path';

import type { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import { Yarn } from '../../utils';
import type { PackageConfig, PackageVersion } from '../../models';

import CONSTANTS from './increment.constants';
import type { Options } from './increment.types';

/**
 * The increment Command configuration Object. This Command is used to increment
 * packages based on the provided CLI Options.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const increment = require('./relative/path/increment.js');
 *
 * const commands = new Commands();
 * commands.mount(increment);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const increment: CommandsCommand<Options> = {
  /**
   * Configuration Object for this Increment Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles incrementing packages based on the provided Options from a
   * Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: Options) => {
    const rootDir = process.cwd();

    return Yarn.list({ since: options.since })
      .then((packageDetails) => packageDetails.map(({ location, name }: PackageConfig) => new Package({
        location: path.join(rootDir, location),
        name,
        tag: options.tag,
      })))
      .then((packs: Array<Package>) => packs.filter((pack) => (options.packages
        ? options.packages.includes(pack.name)
        : true)))
      .then((packs) => Promise.all(packs.map((pack) => pack.inspect())))
      .then((packs) => {
        const incrementBy: Partial<PackageVersion> = {
          major: parseInt(options.major, 10),
          minor: parseInt(options.minor, 10),
          patch: parseInt(options.patch, 10),
          release: parseInt(options.release, 10),
        };

        packs.forEach((pack) => pack.incrementVersion(incrementBy));

        return packs;
      })
      .then((packs) => Promise.all(packs.map((pack) => pack.apply())));
  },
};

export default increment;
