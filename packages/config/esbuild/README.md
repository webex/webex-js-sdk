# @webex/esbuild-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard building workflow in node and browsers in [ESBuild](https://esbuild.github.io/) to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency** and has the following required peer dependencies:

* `esbuild`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/esbuild-config esbuild

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/esbuild-config esbuild
```

## Usage

This package is expected to be used with [ESBuild](https://esbuild.github.io/).

A `esbuild.config.js` configuration file must be consumed within the target package using the following configuration definition example:

```js
// ./esbuild.config.js

const esbuild = require('esbuild');

// Other default configurations may be available.
const { cli } = require('@webex/esbuild-config');

// Import the local package definition in order to process dependencies dynamically
const definition = require('./package.json');

// Build the source code.
esbuild.buildSync({
  ...cli, // default configuration object merge.
  ...{ external: Object.keys(definition.dependencies) }, // list of dependencies to ignore when bundling.
});
```

With the above-defined configuration, the following script[s] can be ammended to the packages `./package.json` file.

```json
{
  "scripts": {
    "build:src": "yarn build:src:{scope}",
    "build:src:{scope}": "node ./esbuild.config.js",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
