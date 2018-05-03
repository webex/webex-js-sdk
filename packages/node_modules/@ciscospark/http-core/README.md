# @ciscospark/http-core

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Core HTTP library for the Cisco Webex JS SDK.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @ciscospark/http-core
```

## Usage

### `detect()`, `detectSync()`

Detects the filetype of the specified file.

### request()

Same api as [request](https://github.com/request/request) with the following changes:

- Promise-based instead of nodeback based
- Adds an interceptors property to the options object for adding classes that intercept and modify each request
- 4XX and 5XX responses get rejected with the appropriate subclassed Error type
- Sensible defaults for our API (`{json:true}`, etc)

### `defaults()`

Curried version of `request()` that produces an http client with overridden defaults.

### `HttpError`

Child of `Error` (by way of `Exception` from `@ciscospark/common`). Has subclassed errors for each [official HTTP status code](https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html) (and 429 Too Man Requests).


## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.
