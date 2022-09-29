# @webex/test-helper-appid

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Test helper for creating App-ID users.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/test-helper-appid
```

## Usage

## `testHelperAppId.createUser(options)`

Wrapper around router which will will make an API call from a web browser or directly invoke `jsonwebtoken` in node. Only required option is `displayName`.

## `testHelperAppId.router`

Express router which will create a JWT from a POST request. Only required body parameter is `displayName`. Use with

```javascript
app.use('/jwt', require('@webex/test-helper-appid').router);
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
