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

We test against the current LTS version of Node.js (8.11) but the SDK should work with any supported version of Node.js.

To install the latest stable version of the SDK from NPM:

```bash
npm install --save ciscospark
```

## Usage

To use the SDK, you will need Cisco Webex credentials. If you do not already have a Cisco Webex account, visit
[Cisco Webex for Developers](https://developer.webex.com/) to create your account and retrieve your **Access Token** from the [Getting Started](https://developer.webex.com/getting-started.html#authentication) page.

See [the detailed docs](https://webex.github.io/spark-js-sdk/) for more usage examples.

```javascript
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

#### _A note on browser usage_

If you've already got a commonjs or es6 build process (like [Webpack](https://webpack.js.org/)) in place, you can simply import/require the package

```javascript
const ciscospark = require('ciscospark');
```

If you need to load `ciscospark` via a script tag, copy and paste the following `<script>` right before your closing `</body>` tag:

```html
<script src="https://www.s4d.io/js-sdk/production/ciscospark.js"></script>
```

2. Create `index.html` .

```html
<html>
  <head>
    <title>Webex SDK for Browsers</title>
  </head>
  <body>
    <script src="./index.js"></script>
  </body>
</html>
```

3. Run `parcel index.html` in your terminal.
4. Go to [http://localhost:1234](http://localhost:1234) and open the developer console to see the output.

#### _[Still using `ciscospark/env`?](documentation/ciscospark.md#nodejs)_

## Samples

Sample code can be found in [packages/node_modules/samples](./packages/node_modules/samples). You can run them yourself with the following commands:

> Note: This installs all of the SDK's tooling dependencies, so you'll need `libgcrypt` and (possibly) `graphicsmagick`.
> On a mac, you can install these with `brew install graphicsmagick libgcrypt`.

```bash
git clone git@github.com:webex/spark-js-sdk.git
cd spark-js-sdk
npm install
npm run samples:serve
```

You'll be able to load the samples by visiting `https://localhost:8000/packages/node_modules/samples/<PACKAGE NAME>`.

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
