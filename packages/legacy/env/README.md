# @webex/env-config-legacy

[![icense: mit](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when the global `.env` values are necessary within a legacy module within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency**.

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/env-config-legacy

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/env-config-legacy
```

## Usage

This package requires the existance of a project-root-level `.env` file.

This package is intended to be consumed within the entry point of a sub-package within this project. Below is an example of standard consumption.

```js
// ./src/main.js

require('@webex/env-config-legacy');

console.log(process.env); // Should contain data from the root `./.env` file.
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
