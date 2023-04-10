import type { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the list Command configuration
 * Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'scripts',
  description: 'Manage and validate scripts within a specified package',
  options: [
    {
      description: 'Package to manage and validate scripts against',
      name: 'package',
      required: true,
      type: 'string',
    },
    {
      description: 'Script to manager or validated on the provided package',
      name: 'script',
      required: true,
      type: 'string',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
