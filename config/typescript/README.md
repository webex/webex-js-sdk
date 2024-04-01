# Configuration - TypesScript

[![license: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

The contents of this folder are used as a shared collection of scripts and files when applying a standard [TypeScript](https://www.typescriptlang.org/) configuration to modern and legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

This package is meant to be consumed as a relative link, and requires the following dependencies:

* `typescript`

Installation of the required dependencies, local to this project, can be performed by using the following commands:

```bash
yarn workspace @{scope}/{package} add --dev typescript
```

## Usage

This package is expected to be used with [TypeScript](https://www.typescriptlang.org/).

a TypeScript configuration file must be consumed within the target package using the following configuration definition example:

```jsonc
// ./tsconfig.json

{
  "extends": "./../../../config/typescript/{modern|legacy}.json", // must directly alias the json file
  "include": [
    "./src/**/*.ts" // Set the files to include when building.
  ]
}
```

Once the `./tsconfig.json` file has been configured based on the information provided above, the following scripts can be amended to the package's `./package.json` file.

```jsonc
{
  "scripts": {
    "build": "{...other build commands...} && yarn build:src",
    "build:src": "{...other source building commands...} && yarn build:module && yarn build:types",
    "build:module": "tsc --declaration false --outDir ./dist/module",
    "build:types": "tsc --declaration --declarationMap --declarationDir ./dist/types --emitDeclarationOnly",
    "test:syntax": "tsc --noEmit"
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
