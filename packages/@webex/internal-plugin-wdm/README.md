# @webex/internal-plugin-wdm

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the WDM service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Deprecation](#deprecation)
- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Deprecation

This plugin has been deprecated and only acts as an alias to the `@webex/internal-plugin-device` plugin. All changes that modify or create an import list that is inclusive of the `@webex/internal-plugin-wdm` plugin should utilize `@webex/internal-plugin-device` instead.

## Install

```bash
npm install --save @webex/internal-plugin-wdm
```

## Usage

```js

import '@webex/internal-plugin-wdm';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.wdm.WHATEVER

```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
