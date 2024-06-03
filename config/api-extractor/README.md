# Configuration - API Extractor

[![license: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

The contents of this folder are used as a shared collection of scripts and files when applying a standard [API Extractor Documentation ruleset](https://api-extractor.com/) to modern and legacy modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

This package is meant to be consumed as a **relative link**, and requires the following **dev-dependencies**:

* `@microsoft/api-extractor`
* `@microsoft/api-documenter`

Installation of the required dependencies, local to this project, can be performed by using the following commands:

```bash
yarn workspace @{scope}/{package} add --dev @microsoft/api-extractor @microsoft/api-documenter
```

## Usage

This package is expected to be used with [API Extractor](https://api-extractor.com/).

An `api-extractor.config.json` configuration file must be consumed within the target package using the following configuration definition example:

```jsonc
// ./api-extractor.config.json

{
  "extends": "./../../../config/api-extractor/index.json",
  "projectFolder": "."
}
```

This will target all built `*.d.ts` files within the `./dist/types/**` folder, and generate output files within the `./dist/docs/metadata/**` folder.

This package is recommended to be used along side the `@microsoft/api-documenter` package by introducing the following script to the packages `./package.json` file.

```json
{
  "scripts": {
    "build": "{...other build commands...} && yarn build:docs",
    "build:docs": "{...other documentation build commands...} && yarn build:docs:api",
    "build:docs:api": "yarn build:docs:api:metadata && yarn build:docs:api:markdown",
    "build:docs:api:metadata": "api-extractor run -c ./api-extractor.config.json",
    "build:docs:api:markdown": "api-documenter markdown --input-folder ./docs/api/metadata --output-folder ./docs/api/markdown",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
