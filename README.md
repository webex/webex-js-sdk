# spark-js-sdk

[![Greenkeeper badge](https://badges.greenkeeper.io/ciscospark/spark-js-sdk.svg)](https://greenkeeper.io/)

[![npm](https://img.shields.io/npm/v/ciscospark.svg?maxAge=86400)](https://www.npmjs.com/package/ciscospark)
[![license](https://img.shields.io/github/license/ciscospark/spark-js-sdk.svg)](https://github.com/webex/spark-js-sdk/blob/master/LICENSE)
[![Build status](https://ci.appveyor.com/api/projects/status/tb1i5vdhy5e3xsgv/branch/master?svg=true)](https://ci.appveyor.com/project/ianwremmel/spark-js-sdk/branch/master)

# The Cisco Webex JS SDK

> Cisco Spark is now Webex Teams! You will notice changes to our documentation and packages as we update over the next several weeks. [Read why this is more than just a rebrand.](https://developer.webex.com/blog/blog-details-9738.html)

This is a monorepo containing all officially maintained Cisco Webex JS SDK modules in the same repo.

[ciscospark](/packages/node_modules/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com).

- [Install](#install)
- [Usage](#usage)
- [Samples](#samples)
- [Contribute](#contribute)
- [License](#license)

## Install

Use the current LTS version of Node.js with support for [npm audit](https://docs.npmjs.com/getting-started/running-a-security-audit).

```bash
npm install -g npm@latest
```

To install the latest stable version of the SDK:

```bash
npm install --save ciscospark
```

## Usage

To use the SDK, you will need Cisco Webex credentials. If you do not already have a Cisco Webex account, visit
[Cisco Webex for Developers](https://developer.webex.com/) to create your account and retrieve your access token.

See [the detailed docs](https://webex.github.io/spark-js-sdk/) for more usage examples.

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
[docs site](https://webex.github.io/spark-js-sdk/guides/browsers/) for more information.

## Samples

Sample code can be found in [packages/node_modules/samples](./packages/node_modules/samples). You can run them yourself with the following commands:

> Note: this installs all of the SDK's tooling dependencies, so you'll need `libgcrypt` and (possibly) `graphicsmagick`. On a mac, you can install these with `brew install graphicsmagick libgrcrypt`.

```bash
git clone git@github.com:webex/spark-js-sdk.git
cd spark-js-sdk
npm install
npm run samples:serve
```

You'll be able to load the samples by visiting `https://localhost:8000/packages/node_modules/samples/<PACKAGE NAME>`.

### Available Samples

| Sample | App Link | Source |
| ------ | -------- | ------ |
| Implicit Grant Flow | [local app](https://localhost:8000/packages/node_modules/samples/browser-auth-implicit) | [code](./packages/node_modules/samples/browser-auth-implicit) |
| Single Party Calling | [local app](https://localhost:8000/packages/node_modules/samples/browser-single-party-call) | [code](./packages/node_modules/samples/browser-single-party-call) |
| Single Party Calling with Mute | [local app](https://localhost:8000/packages/node_modules/samples/browser-single-party-call-with-mute) | [code](./packages/node_modules/samples/browser-single-party-call-with-mute) |
| Multi Party Calling | [local app](https://localhost:8000/packages/node_modules/samples/browser-multi-party-call) | [code](./packages/node_modules/samples/browser-multi-party-call) |
| Call with Content Sharing | [local app](https://localhost:8000/packages/node_modules/samples/browser-call-with-screenshare) | [code](./packages/node_modules/samples/browser-call-with-screenshare) |

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more details about building the packages
and submitting pull requests for suggested changes.

## License

© 2016-2018 Cisco and/or its affiliates. All Rights Reserved.

See [LICENSE](LICENSE) for details.
