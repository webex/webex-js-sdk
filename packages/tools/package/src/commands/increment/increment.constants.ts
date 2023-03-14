import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the increment Command configuration
 * Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'increment',
  description: 'Increment the version of the filtered packages',
  options: [
    {
      description: 'Major version to increment by',
      name: 'major',
      type: 'number',
    },
    {
      description: 'Minor version to increment by',
      name: 'minor',
      type: 'number',
    },
    {
      description: 'Packages to target when incrementing',
      name: 'packages',
      type: 'string...',
    },
    {
      description: 'Patch version to increment by',
      name: 'patch',
      type: 'number',
    },
    {
      description: 'Release version to increment by',
      name: 'release',
      type: 'number',
    },
    {
      description: 'Git reference to collect changed packages since',
      name: 'since',
      type: 'string',
    },
    {
      description: 'Release tag to target when incrementing packages',
      name: 'tag',
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
