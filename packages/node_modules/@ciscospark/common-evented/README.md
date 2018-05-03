# @ciscospark/common-evented

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Class property decorator the adds change events to properties

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @ciscospark/common-evented
```

## Usage

```js

const evented = require(`@ciscospark/common-evented`);
const Events = require(`ampersand-events`);

class X extends Events {
  @evented
  prop = null
}

const x = new X();
x.on(`change:prop`, () => {
  console.log(x.prop)
  // => 6
});
x.prop = 6;
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.
