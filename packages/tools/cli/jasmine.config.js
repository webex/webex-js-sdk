const Jasmine = require('jasmine');

const { config, reporter } = require('@webex/jasmine-config');
const { Command } = require('@webex/cli-tools');

const { mod, silent } = new Command({
  options: [
    {
      description: 'perform module tests',
      name: 'mod',
      type: 'boolean',
    },
    {
      description: 'remove reporters',
      name: 'silent',
      type: 'boolean',
    },
  ],
}).results;

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
