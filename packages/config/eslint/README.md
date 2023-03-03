# @webex/eslint-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard [ESLint](https://eslint.org/) ruleset to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency**, and requires the following peer-dependencies:

* `eslint`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/eslint-config eslint

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/eslint-config eslint
```

## Usage

This package is expected to be used with [ESLint](https://eslint.org/).

a ESLint configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./.eslintrc.js

const config = {
  root: true, // Ignore all `.eslintrc.js` files in any parent directories.
  env: {
    node: true,
    // any additional env values needed for the package.
  },
  extends: [
    '@webex/eslint-config/core', // The base configuration.
    '@webex/eslint-config/jasmine', // Jasmine testing configuration.
    '@webex/eslint-config/typescript', // Typescript configuration.
  ],
  // Additional package configuration as needed.
};

module.exports = config;
```

Once the `./.eslintrc.js` file has been configured based on the information provided above, the following scripts can be amended to the package's `./package.json` file.

```json
{
  "scripts": {
    "test:static:style": "eslint ./src/**/*.*"
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
