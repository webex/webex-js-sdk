# @ciscospark/common-timers

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Timer wrappers for the Cisco Webex JS SDK. See https://webex.github.io/spark-js-sdk/

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @ciscospark/common-timers
```

## Usage

Works just like `setTimeout` and `setInterval`, but doesn't wedge a node process open.

```js
import {safeSetTimeout, safeSetInterval} from '@ciscospark/common-timers';

const timer = safeSetTimeout(() => {}, 1000);

const interval = safeSetInterval(() => {}, 1000);
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.
