# @webex/storage-adapter-spec

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Blackbox test suite for storage adapters

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save-dev @webex/storage-adapter-spec
```

## Usage

```js
import runAbstractStorageAdapterSpec from '@webex/storage-adapter-spec';
import MyStorageAdapter from './my-storage-adapter';

describe('MyStorageAdapter', () => {
  runAbstractStorageAdapterSpec(new MyStorageAdapter('test'));
});

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
```
