import { CommandsConfig } from '@webex/cli-tools';

/**
 * `Commands.mount()` Commands Configuration Object for the build Command
 * Configuration Object.
 *
 * @public
 */
const CONFIG: CommandsConfig = {
  name: 'build',
  description: 'Build a legacy package',
  options: [
    {
      alias: 'dest',
      description: 'Destination to build source files to',
      name: 'destination',
      required: true,
      type: 'string',
    },
    {
      alias: 'maps',
      description: 'Whether to generate source-map files',
      name: 'generate-source-maps',
      type: 'boolean',
    },
    {
      alias: 'js',
      description: 'Whether to process JavaScript files',
      name: 'javascript',
      type: 'boolean',
    },
    {
      alias: 'src',
      description: 'Source files to build the destination files from',
      name: 'source',
      required: true,
      type: 'string',
    },
    {
      alias: 'ts',
      description: 'Whether to process TypeScript files',
      name: 'typescript',
      type: 'boolean',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
