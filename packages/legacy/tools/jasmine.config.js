const Jasmine = require('jasmine');

const { config, reporter } = require('@webex/jasmine-config');
const { Commands } = require('@webex/cli-tools');

const test = {
  config: {
    name: 'test',
    description: 'Perform tests',
    options: [
      {
        description: 'Perform integration tests against the module',
        name: 'integration',
      },
      {
        description: 'Remove all reporters',
        name: 'silent',
      },
    ],
  },

  handler: (options) => {
    const { integration, silent } = options;

    const jasmine = new Jasmine();
    const targets = [];

    config(jasmine);
    jasmine.clearReporters();

    if (integration) {
      targets.push(
        './test/integration/**/*.test.js',
        './test/integration/**/*.spec.js',
      );
    }

    if (!silent) {
      reporter(jasmine);
    }

    jasmine.execute(targets);
  },
};

const commands = new Commands();
commands.mount(test);
commands.process();
