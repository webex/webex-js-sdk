# @webex/cli-tools

[![icense: mit](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when performing operations against packages within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dependency**.

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add @webex/package-tools

# Package installation.
yarn workspace @{scope}/{package} add @webex/package-tools
```

## Usage

This package is intended to be consumed as a CLI executable.

```bash
webex-package-tools {command} {...options}
```

To see a list of available commands and their associated options, run the following command against this package:

```bash
webex-package-tools --help
```

This package can also be consumed as a module. Note that this is not an explicitly intended use-case, but may provide more flexibility when performing complicated workflows.

```js
const { increment, list, Package, Yarn } = require('@webex/package-tools');

// Execute a command. See API documentation or CLI help for more information.
increment.handle(options);
list.handle(options);

// Manage a package. See API documentation for more information.
const pack = new Package(options);
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
