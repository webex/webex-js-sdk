import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the sync Command
 * Configuration Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'sync',
  description: 'Synchronize the dependencies of filtered packages with npm',
  options: [
    {
      description: 'Packages to synchronize with npm',
      name: 'packages',
      type: 'string...',
    },
    {
      description: 'Tag to synchronize the package with on npm',
      name: 'tag',
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
