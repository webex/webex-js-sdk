# @webex/legacy-tools

[![icense: mit](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a common tooling workflow to legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency**, and requires the following localized dependencies:

* `@babel/core` - *Peer development dependency*.
* `@webex/babel-config-legacy` - *Development dependency*.

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/legacy-tools @webex/babel-config-legacy @babel/core

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/legacy-tools @webex/babel-config-legacy @babel/core
```

## Usage

This package is expected to be used with [Babel](https://babeljs.io/).

This package was intended to be used with [@webex/babel-config-legacy](https://github.com/webex/webex-js-sdk/tree/master/packages/legacy/babel), but should support most babel configurations.

This package is expected to be used as a CLI or Module within a consuming package.

### CLI Consumption

```json
// ./package.json
{
  /* ... */
  "scripts": {
    /* ... */
    "{script-name}": "webex-legacy-tools {command} {arguments} {--help}"
  }
}
```

Documentation for each of the available arguments can be found by using the `--help` argument.

### Module Consumption

To consume this package as a module:

```js
// ESM
import {File, Package} from '@webex/legacy-tools';

// CJS
const {File, Package} = require('@webex/legacy-tools');

// Build all package files.
Package.build(arguments);

// Build a specific file.
File.build(arguments);
```

For arguments for each class, see the built documentation by executing the following command:

```bash
yarn workspace @webex/legacy-tools build
```

Then, navigate to the `./dist/docs/markdown/index.md` file.

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
