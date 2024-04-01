# Configuration - ESLint

[![license: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

The contents of this folder are used as a shared collection of scripts and files when applying a standard [ESLint](https://eslint.org/) ruleset to modern and legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

This package is meant to be consumed as a **relative link**, and requires the following **dev-dependencies**:

* **javascript.modern**
  * `eslint`
  * `eslint-config-airbnb-base`
  * `eslint-plugin-import`
  * `eslint-plugin-jsdoc`
* **typescript.modern**
  * `eslint`
  * `eslint-config-airbnb-base`
  * `eslint-plugin-import`
  * `eslint-plugin-jsdoc`
  * `eslint-config-airbnb-typescript`
  * `eslint-plugin-tsdoc`
  * `typescript`
* **jest.modern**
  * `eslint`
  * `eslint-config-airbnb-base`
  * `eslint-plugin-import`
  * `jest`


Installation of the required dependencies, local to this project, can be performed by using the following commands:

```bash
# javascript.modern
yarn workspace @{scope}/{package} add --dev \
  eslint \
  eslint-config-airbnb-base \
  eslint-plugin-import \
  eslint-plugin-jsdoc

# typescript.modern
yarn workspace @{scope}/{package} add --dev \
  eslint \
  eslint-config-airbnb-base \
  eslint-plugin-import \
  eslint-plugin-jsdoc \
  eslint-config-airbnb-typescript \
  eslint-plugin-tsdoc \
  typescript

# jest.modern
yarn workspace @{scope}/{package} add --dev \
  eslint \
  eslint-config-airbnb-base \
  eslint-plugin-jsdoc \
  jest
```

## Usage

This package is expected to be used with [ESLint](https://eslint.org/).

An ESLint configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./.eslintrc.js

const { javascript, jest, typescript } = require('../../../config/eslint');
const definition = require('./package.json');

const config = {
  root: true,
  env: {
    node: true,
  },
  overrides: [
    ...javascript.modern({ packageName: definition.name }).overrides,
    ...jest.modern({ packageName: definition.name }).overrides,
    ...typescript.modern({ packageName: definition.name }).overrides,
  ],
};

module.exports = config;
```

Once the `./.eslintrc.js` file has been configured based on the information provided above, the following scripts can be amended to the package's `./package.json` file.

```jsonc
{
  "scripts": {
    "test": "{...other test commands...} && yarn test:style",
    "test:style": "eslint ./test/**/*.* ./src/**/*.*",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
