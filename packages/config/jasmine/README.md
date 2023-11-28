# @webex/jasmine-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard testing workflow in node and browsers in [Jasmine](https://jasmine.github.io/) to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency** and has the following required peer dependencies:

* `jasmine`

This package is meant to be configured at runtime using the following **dev-dependency**:

* `@webex/cli-tools`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/jasmine-config @webex/cli-tools jasmine

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/jasmine-config @webex/cli-tools jasmine
```

## Usage

This package is expected to be used with [Jasmine](https://jasmine.github.io/) and [@webex/cli-tools](https://github.com/webex/webex-js-sdk/tree/master/packages/tools/cli).

A `jasmine.config.js` configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./jasmine.config.js

const Jasmine = require('jasmine');

const { config, reporter } = require('@webex/jasmine-config');
const { Commands } = require('@webex/cli-tools');

// Configure the CLI options for integration tests.
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

  // Handle the provided options.
  handler: (options) => {
    const { mod, silent } = options;

    // Construct a new Jasmine instance and define target files to test.
    const jasmine = new Jasmine();
    const targets = [];

    // Mount the common configuration to the Jasmine instance.
    config(jasmine);
    jasmine.clearReporters();

    // Add module tests as the target if provided.
    if (mod) {
      targets.push(
        './test/module/**/*.test.js',
        './test/module/**/*.spec.js',
      );
    }

    // Silence reporters if provided.
    if (!silent) {
      reporter(jasmine);
    }

    // Run Jasmine test suite.
    jasmine.execute(targets);
  },
};

// Setup a new Commands instance, provide the configuration, and execute.
const commands = new Commands();
commands.mount(integration);
commands.process();
```

With the above-defined configuration, the following script[s] can be ammended to the packages `./package.json` file.

```json
{
  "scripts": {
    "test:integration": "yarn test:integration:module",
    "test:integration:module": "node ./jasmine.config.js --mod",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
