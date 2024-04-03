# Configuration - Jest

[![license: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

The contents of this folder are used as a shared collection of scripts and files when applying a standard [Jest](https://jestjs.io/) configuration to modern and legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

This package is meant to be consumed as a **relative link**, and requires the following **dev-dependencies**:

* `jest`
* `jest-silent-reporter`

Installation of the required dependencies, local to this project, can be performed by using the following commands:

```bash
yarn workspace @{scope}/{package} add --dev jest jest-silent-reporter
```

## Usage

This package is expected to be used with [Jest](https://jestjs.io/).

a Jest configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./jest.config.js

const { modern } = require('../../../config/jest');

module.exports = modern; // For newer jest configurations.
```

Once the `./jest.config.js` file has been configured based on the information provided above, the following scripts can be amended to the package's `./package.json` file.

```jsonc
{
  "scripts": {
    "test": "{...other test commands...} && yarn test:integration && yarn test:coverage",
    "test:coverage": "yarn test:integration --coverage --reporters=\"jest-silent-reporter\"",
    "test:integration": "jest",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
