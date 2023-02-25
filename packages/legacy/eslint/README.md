# @webex/eslint-config-legacy

[![icense: mit](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard [ESLint](https://eslint.org/) ruleset to legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency**, and requires the following peer-dependencies:

* `@babel/core`
* `eslint`
* `prettier`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/eslint-config-legacy @babel/core eslint prettier

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/eslint-config-legacy @babel/core eslint prettier
```

## Usage

This package is expected to be used with [ESLint](https://eslint.org/).

a ESLint configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./.eslintrc.js

const config = {
  root: true, // Ignore all `.eslintrc.js` files in any parent directories.
  extends: ['@webex/eslint-config-legacy'], // Extend this module's configuration.
};

module.exports = config;
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
