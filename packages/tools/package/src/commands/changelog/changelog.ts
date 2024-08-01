import path from 'path';

import { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';
import { Yarn } from '../../utils';
import type { PackageConfig } from '../../models';

import CONSTANTS from './changelog.constants';
import type { Options } from './changelog.types';
import { createOrUpdateChangelog } from './changelog.utils';

/**
 * @public
 */
const changelog: CommandsCommand<Options> = {
  /**
   * Configuration Object for this changelog Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles the creation of changelog for packages based on the provided Options
   * from a Commands class instance.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: Options) => {
    if (!options.packages) {
      return Promise.resolve({});
    }
    const rootDir = process.cwd();

    const tag = options.tag?.split('/').pop();

    return Yarn.list()
      .then((packageDetails) => packageDetails.map(
        ({ location, name }: PackageConfig) => new Package({
          location: path.join(rootDir, location),
          name,
          tag,
        }),
      ))
      .then((packs: Array<Package>) => packs.filter(
        (pack) => options.packages.includes(pack.name),
      ))
      .then((packs) => Promise.all(packs.map((pack) => pack.inspect())))
      .then(async (packs) => {
        createOrUpdateChangelog(packs, options.commit);
      });
  },
};

export default changelog;
