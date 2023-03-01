# @webex/api-extractor-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard API Metadata Documentation ruleset to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency** and requires the following peer dependencies:

* `@microsoft/api-extractor`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/api-extractor-config @microsoft/api-extractor

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/api-extractor-config @microsoft/api-extractor
```

## Usage

This package is expected to be used independently, but is recommended to be used with `@microsoft/api-documenter`.

An `api-extractor.config.json` configuration file must be consumed within the target package using the following configuration definition example:

```json
// ./api-extractor.config.json

{
  "extends": "@webex/api-extractor-config/static/index.json",
  "projectFolder": "."
}
```

This will target all built `*.d.ts` files within the `./dist/types/**` folder, and generate output files within the `./dist/docs/metadata/**` folder.

This package is recommended to be used along side the `@microsoft/api-documenter` package by introducing the following script to the packages `./package.json` file.

```json
{
  "scripts": {
    "build:docs:metadata": "api-extractor run -c ./api-extractor.config.json",
    "build:docs:markdown": "api-documenter markdown --input-folder ./dist/docs/metadata --output-folder ./dist/docs/markdown",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
