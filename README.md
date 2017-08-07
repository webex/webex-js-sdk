# spark-js-sdk

[![npm](https://img.shields.io/npm/v/ciscospark.svg?maxAge=86400)](https://www.npmjs.com/package/ciscospark)
[![license](https://img.shields.io/github/license/ciscospark/spark-js-sdk.svg)](https://github.com/ciscospark/spark-js-sdk/blob/master/LICENSE)

> The Cisco Spark JavaScript SDK

This is a monorepo containing all officially maintained Cisco Spark JavaScript SDK modules in the same repo.

[ciscospark](/packages/node_modules/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com).

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

We test against the current LTS version of Node.js (6.10) but the SDK should work with any supported version of Node.js.

To install the latest stable version from NPM:

```bash
npm install --save ciscospark
```

## Usage

To use the SDK, you will need Cisco Spark credentials. If you do not already have a Cisco Spark account, visit
[Spark for Developers](https://developer.ciscospark.com/) to create your account and retrieve your access token.

See [the detailed docs](https://ciscospark.github.io/spark-js-sdk/) for more usage examples.

### Node.js

You will need to set the following environment variable:
- `CISCOSPARK_ACCESS_TOKEN`

```javascript
const assert = require(`assert`);
assert(process.env.CISCOSPARK_ACCESS_TOKEN, 'This example assumes you have set your access token as an environment variable');
const ciscospark = require(`ciscospark`);
ciscospark.rooms.create({title: `My First Room`})
  .then((room) => {
    return Promise.all([
      ciscospark.memberships.create({
        roomId: room.id,
        personEmail: `alice@example.com`
      }),
      ciscospark.memberships.create({
        roomId: room.id,
        personEmail: `bob@example.com`
      }),
    ])
      .then(() => ciscospark.messages.create({
        markdown: `**Hi Everyone**`,
        roomId: room.id
      }));
  });
```

### Browsers

We do not provide a pre-built version of `ciscospark`.

If you've already got a commonjs or es6 build process in place, you can simply
use `const ciscospark = require('ciscospark')`.

If you need to load `ciscospark` via a script tag, you will need to build it first:

```bash
npm install ciscospark
npm install -g browserify
echo "window.ciscospark = require('ciscospark')" > ./index.js
browserify index.js > bundle.js
```

In-browser usage is pretty much the same as Node.js usage, with the addition of handling
the user authentication flow for you. See the guide on the
[docs site](https://ciscospark.github.io/spark-js-sdk/guides/browsers/) for more information.

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more details about building the packages
and submitting pull requests for suggested changes.

## License

&copy; 2016-2017 Cisco Systems, Inc. and/or its affiliates. All Rights Reserved.

See [LICENSE](LICENSE) for details.
