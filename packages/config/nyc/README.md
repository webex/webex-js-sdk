# @webex/nyc-config

[![icense: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: beta](https://img.shields.io/badge/State\-Beta-blue?style=flat-square)
![scope: internal](https://img.shields.io/badge/Scope-Internal-red?style=flat-square)

This package is an internal and private plugin used as a shared module when applying a standard coverage testing in node and browsers through [Jasmine](https://jasmine.github.io/) and [NYC](https://github.com/istanbuljs/nyc) to modern modules within this project.

* [Installation](#installation)
* [Usage](#usage)
* [Contribute](#contribute)
* [Maintainers](#maintainers)

## Installation

Since this package is marked `private` as a part of its definition, it can only be consumed locally within this project.

This package is meant to be consumed as a **dev-dependency** and has the following required peer dependencies:

* `@webex/jasmine-config`
  * `@webex/cli-tools`
* `jasmine`
* `nyc`

This package is meant to be configured at runtime using the following **dev-dependency**:

* `@webex/cli-tools`

Installation, local to this project, can be performed by using the following commands:

```bash
# Project root installation.
yarn add --dev @webex/nyc-config @webex/jasmine-config @webex/cli-tools jasmine nyc

# Package installation.
yarn workspace @{scope}/{package} add --dev @webex/nyc-config @webex/jasmine-config @webex/cli-tools jasmine nyc
```

## Usage

This package is expected to be used with [NYC](https://github.com/istanbuljs/nyc), [Jasmine](https://jasmine.github.io/), [@webex/jasmine-config](https://github.com/webex/webex-js-sdk/tree/master/packages/config/jasmine), and [@webex/cli-tools](https://github.com/webex/webex-js-sdk/tree/master/packages/tools/cli).

A `jasmine.config.js` configuration file must be consumed within the target package using the following the configuration example available within the [@webex/jasmine-config](https://github.com/webex/webex-js-sdk/tree/master/packages/config/jasmine) package.

Once the `jasmine.config.js` file has been configured per the [@webex/jasmine-config](https://github.com/webex/webex-js-sdk/tree/master/packages/config/jasmine) package, the following scripts can be amended to the package's `./package.json` file.

```json
{
  "scripts": {
    "test:coverage": "nyc yarn test:integration --silent",
    "test:coverage:report": "nyc --reporter=lcov yarn test:integration --silent",
  }
}
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).
