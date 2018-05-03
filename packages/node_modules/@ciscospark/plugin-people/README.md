# @ciscospark/plugin-people

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> People plugin for the Cisco Webex JS SDK.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @ciscospark/plugin-people
```

## Usage

This is a plugin for the Cisco Webex JS SDK . Please see our [developer portal](https://developer.webex.com/sdks-and-widgets.html) and the [API docs](https://webex.github.io/spark-js-sdk/api/) for full details.

## Install

```bash
npm install --save @ciscospark/plugin-people
```

## Usage

```js

const ciscospark = require('ciscospark');

const spark = ciscospark.init()
spark.people.get(id)
  .then((people) => {
    console.log(people);
  })

```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.
