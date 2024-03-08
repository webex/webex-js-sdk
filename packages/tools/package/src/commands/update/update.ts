import fs from 'fs/promises';
import path from 'path';

import type { CommandsCommand } from '@webex/cli-tools';

import { Package } from '../../models';

import CONSTANTS from './update.constants';
import type { Options } from './update.types';

/**
 * The update Command configuration Object. This Command is used to update
 * the versions of the provided dependencies within the repository.
 *
 * @remarks
 * This Object is used as a mountable configuration for `@webex/cli-tools`
 * Commands class instances, using the `new Commands().mount()` method.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 * const update = require('./relative/path/update.js');
 *
 * const commands = new Commands();
 * commands.mount(update);
 * commands.mount(otherCommandConfig);
 * commands.process();
 * ```
 *
 * @public
 */
const update: CommandsCommand<Options> = {
  /**
   * Configuration Object for this update Command configuration.
   */
  config: CONSTANTS.CONFIG,

  /**
   * Handles synchonization of dependency versions within packages.
   *
   * @param options - Options provided from the CLI interface.
   * @returns - Promise that resolves once the process is complete.
   */
  handler: (options: Options) => {
    const rootDir = process.cwd();

    const { packages = [], tag = Package.CONSTANTS.STABLE_TAG } = options;
    const definitionPath = path.join(rootDir, Package.CONSTANTS.PACKAGE_DEFINITION_FILE);

    let packageDefinition: any;

    return Package.readDefinition({ definitionPath })
      .then((definition: Record<string, any>) => {
        packageDefinition = definition;

        const groups = [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'bundleDependencies',
          'optionalDependencies',
        ];

        const dependencies = groups.reduce(
          (output: Array<any>, group) => {
            const groupDependencies: Record<string, string> = definition[group] || {};

            return [
              ...output,
              ...Object.entries(groupDependencies).map(([name, version]) => ({ group, name, version })),
            ];
          },
          [] as Array<any>,
        ).filter((dependency) => packages.includes(dependency.name));

        return Promise.all(dependencies.map((dependency) => Package.inspect({ package: dependency.name })
          .then((result) => ({
            ...dependency,
            previous: dependency.version,
            version: result['dist-tags'][tag] || dependency.version,
          }))));
      })
      .then((dependencies) => {
        dependencies.forEach((dependency) => {
          const { group, name, version } = dependency;
          const target = packageDefinition[group];

          target[name] = version;
        });

        const data = `${JSON.stringify(packageDefinition, null, 2)}\n`;
        const output = dependencies.map((dependency) => (dependency.previous !== dependency.version
          ? `${dependency.name}: ${dependency.previous} => ${dependency.version}`
          : '')).filter((line) => !!line).join('\n');

        return fs.writeFile(definitionPath, data, { encoding: 'utf-8' })
          .then(() => {
            process.stdout.write(output);
          });
      });
  },
};

export default update;
