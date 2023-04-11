

# @webex/cli-tools

[![icense: mit](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when configuring CLI operations within this project.

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
yarn add --dev @webex/cli-tools

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/cli-tools
```

## Usage

This package is expected to be consumed as a JavaScript module.

```js
const CLI = require('@webex/cli-tools');
```

Below is a list of common classes and their usage. See documentation for more information.

### Command Class

The `Command` class is intended to be used as a way to interpret CLI arguments for usage within a workflow.

```js
const { Command } = require('@webex/cli-tools');

const { example } = new Command({
  options: [
    {
      name: 'example',
      description: 'example option description',
      type: 'string',
    },
  ],
}).results;
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
