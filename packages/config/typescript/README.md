# @webex/typescript-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard [TypeScript](https://www.typescriptlang.org/) configuration to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency**, and requires the following peer-dependencies:

* `typescript`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/typescript-config typescript

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/typescript-config typescript
```

## Usage

This package is expected to be used with [TypeScript](https://www.typescriptlang.org/).

a TypeScript configuration file must be consumed within the target package using the following configuration definition example:

```json
// ./tsconfig.json

{
  "extends": "@webex/typescript-config/static/index.json", // must directly alias the json file
  "compilerOptions": {
    "outDir": "./dist/module", // Set out directory.
    "declarationDir": "./dist/types", // Set declration directory.
  },
  "include": [
    "./src/**/*.ts" // Set the files to include when building.
  ]
}
```

Once the `./tsconfig.json` file has been configured based on the information provided above, the following scripts can be amended to the package's `./package.json` file.

```json
{
  "scripts": {
    "build": "yarn build:src",
    "build:src": "tsc",
    "test:static:syntax": "tsc --noEmit"
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
