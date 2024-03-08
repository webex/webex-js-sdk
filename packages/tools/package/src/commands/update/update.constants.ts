import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the update Command
 * Configuration Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'update',
  description: 'Update the dependencies for this local package',
  options: [
    {
      description: 'Packages to be updated',
      name: 'packages',
      type: 'string...',
    },
    {
      description: 'Tag to update this local package with on npm',
      name: 'tag',
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
