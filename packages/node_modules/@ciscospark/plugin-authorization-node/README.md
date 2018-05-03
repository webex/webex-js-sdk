# @ciscospark/plugin-authorization-node

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Authorization plugin loaded when the Cisco Webex JS SDK is used in a non-browser environment.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @ciscospark/plugin-authorization-node
```

## Usage

This is a plugin for the Cisco Webex JS SDK . Please see our [developer portal](https://developer.webex.com/sdks-and-widgets.html) and the [API docs](https://webex.github.io/spark-js-sdk/api/) for full details.

## Install

```bash
npm install --save @ciscospark/plugin-authorization-node
```

## Usage

```js

const ciscospark = require('ciscospark');

const spark = ciscospark.init()
spark.authorization-node.get(id)
  .then((authorization-node) => {
    console.log(authorization-node);
  })

```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.
