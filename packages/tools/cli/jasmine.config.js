const Jasmine = require('jasmine');

const { config, reporter } = require('@webex/jasmine-config');
const { Commands } = require('@webex/cli-tools');

const integration = {
  config: {
    name: 'integration',
    description: 'Perform integration tests',
    options: [
      {
        description: 'Perform integration tests against the module',
        name: 'mod',
      },
      {
        description: 'Remove all reporters',
        name: 'silent',
      },
    ],
  },

  handler: (options) => {
    const { mod, silent } = options;

    const jasmine = new Jasmine();
    const targets = [];

    config(jasmine);
    jasmine.clearReporters();

    if (mod) {
      targets.push(
        './test/module/**/*.test.js',
        './test/module/**/*.spec.js',
      );
    }

    if (!silent) {
      reporter(jasmine);
    }

    jasmine.execute(targets);
  },
};

const commands = new Commands();
commands.mount(integration);
commands.process();
