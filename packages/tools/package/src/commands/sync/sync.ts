import path from 'path';

import type { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import { Yarn } from '../../utils';
import type { PackageConfig } from '../../models';

import CONSTANTS from './sync.constants';
import type { Options, ViewResult } from './sync.types';

/**
 * The sync Command configuration Object. This Command is used to synchronize
 * the versions of dependencies within the repository.
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
const sync: CommandsCommand<Options> = {
  /**
   * Configuration Object for this increment Command configuration.
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

    const tag = options.tag?.split('/').pop();

    return Yarn.list()
      .then((packageDetails) => packageDetails.map(({ location, name }: PackageConfig) => new Package({
        location: path.join(rootDir, location),
        name,
        tag,
      })))
      .then((packs: Array<Package>) => packs.filter((pack) => (options.packages
        ? options.packages.includes(pack.name)
        : true)))
      .then((packs) => Promise.all(packs.map((pack) => pack.inspect())))
      .then((packs) => Promise.all(packs.map((pack) => pack.syncVersion())))
      .then((packs) => {
        packs.map((pack: Package) => {
          Yarn.view({ package: pack.name }).then((res: ViewResult) => {
            const { dependencies, devDependencies } = res;
            pack.syncDependency(dependencies).then(() => pack.syncDependency(devDependencies, true));
          });

          return pack;
        });

        return Promise.all('');
      });
  },
};

export default sync;
