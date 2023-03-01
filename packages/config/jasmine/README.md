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
const { Command } = require('@webex/cli-tools');

// Setup a standard set of arguments to consume
const { mod, silent } = new Command({
  options: [
    {
      description: 'perform module tests',
      name: 'mod', // For identifying module tests.
      type: 'boolean',
    },
    {
      description: 'remove reporters',
      name: 'silent', // For identifying if the reporter should be deactivated.
      type: 'boolean',
    },
  ],
}).results;

// Create a new Jasmine instance and set up the targets.
const jasmine = new Jasmine();
const targets = [];

config(jasmine);
jasmine.clearReporters();

if (mod) { // If a module, target the module tests.
  targets.push(
    './test/module/**/*.test.js',
    './test/module/**/*.spec.js',
  );
}

if (!silent) { // If silent, remove the reporter.
  reporter(jasmine);
}

// Execute the test runner.
jasmine.execute(targets);
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
