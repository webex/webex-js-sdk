import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the update Command
 * Configuration Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'changelog',
  description: 'Update the changelog',
  options: [
    {
      description: 'Packages to be added in changelog',
      name: 'packages',
      type: 'string...',
    },
    {
      description: 'Tag to use while fetching details from npm',
      name: 'tag',
      type: 'string',
    },
    {
      description: 'Previous commit id',
      name: 'commit',
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
