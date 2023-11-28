import { CommandsConfig } from '@webex/cli-tools';

const CONFIG: CommandsConfig = {
  name: 'test',
  description: 'Test a legacy package',
  options: [
    {
      description: 'Run automation-scoped tests.',
      name: 'automation',
      type: 'boolean',
    },
    {
      description: 'Run documentation-scoped tests.',
      name: 'documentation',
      type: 'boolean',
    },
    {
      description: 'Run integration-scoped tests.',
      name: 'integration',
      type: 'boolean',
    },
    {
      alias: 'browsers',
      default: ['chrome', 'firefox'],
      description: 'Browsers to use when running Karma tests.',
      name: 'karma-browsers',
      type: 'array',
    },
    {
      alias: 'debug',
      description: 'Run Karma in debug mode',
      name: 'karma-debug',
      type: 'boolean',
    },
    {
      alias: 'port',
      description: 'Port to run the Karma server on',
      name: 'karma-port',
      type: 'string',
    },
    {
      description: 'Test runner to use.',
      name: 'runner',
      type: 'array',
    },
    {
      description: 'Override the default test target for reading files.',
      name: 'target',
      type: 'string',
    },
    {
      description: 'Run unit-scoped tests.',
      name: 'unit',
      type: 'boolean',
    },
  ],
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;
