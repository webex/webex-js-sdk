import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the list Command configuration
 * Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'list',
  description: 'List packages within this project based on the provided options',
  options: [
    {
      description: 'Include private packages when listing packages',
      name: 'private',
    },
    {
      description: 'Include all dependents when listing packages',
      name: 'recursive',
    },
    {
      description: 'Git reference to collect changed packages since',
      name: 'since',
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
