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

We test against the [Active LTS](https://github.com/nodejs/Release#release-schedule) (Long Term Support) version of Node.js and use **npm@6** to run [security audits](https://docs.npmjs.com/getting-started/running-a-security-audit).

To install the latest stable version of the SDK from NPM:

```bash
npm install --save ciscospark
```

## Usage

To use the SDK, you will need Cisco Webex credentials. If you do not already have a Cisco Webex account, visit
[Cisco Webex for Developers](https://developer.webex.com/) to create your account and retrieve your access token.

See [the detailed docs](https://webex.github.io/spark-js-sdk/) for more usage examples.

You will need to set the following environment variable:

- `CISCOSPARK_ACCESS_TOKEN`

```javascript
const ciscospark = require(`ciscospark`);
const spark = ciscospark.init({
  credentials: {
    access_token: process.env.CISCOSPARK_ACCESS_TOKEN
  }
});

spark.rooms
  .create({
    title: 'My First Room!'
  })
  .catch(function(error) {
    console.error(error);
  });

spark.rooms
  .list({
    max: 10
  })
  .then(function(rooms) {
    var room = rooms.items.filter(function(room) {
      return room.title === 'My First Room!';
    })[0];

    spark.messages.create({
      text: 'Hello World!',
      roomId: room.id
    });

    return spark.messages
      .list({ roomId: room.id, max: 1 })
      .then(function(messages) {
        console.log(
          `Last message sent to Room "${room.title}": ${messages.items[0].text}`
        );
      });
  })
  .catch(function(error) {
    console.error(error);
  });

```

### _A note on Browser usage_

We do not provide a pre-built version of the SDK that includes a `window.ciscospark`.
If you're already using a bundler (like [Webpack](https://webpack.js.org/) or [Rollup](https://rollupjs.org/)) you can simply import/require the package and use the above snippet and assign the initialized `spark` variable to `window.ciscospark`.
In-browser usage is pretty much the same as Node.js usage, with the addition of handling the user authentication flow for you. See the guide on the [docs site](https://webex.github.io/spark-js-sdk/guides/browsers/) for more information.

For a quick example on how to use the SDK on a website, we'll be using the [Parcel Bundler](https://parceljs.org/). For any more information and questions on how to use Parcel, please head to their [website](https://parceljs.org/).

1. Put the above javascript snippet into a `index.js`
  a. If you'd like to have `window.ciscospark` available, change the init line to `const spark = window.ciscospark = ciscospark.init`
2. Create a `index.html` with the snippet below
3. Run `parcel index.html` in your terminal
4. Go to [http://localhost:1234](http://localhost:1234) and open the developer console to see the output

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

#### `ciscospark/env`

`ciscospark/env` is primarily used for the Node.js environment and will continue to be supported, however we suggest that you import/require `ciscospark`.
The only difference is between `ciscospark` and `ciscospark/env` is that `ciscospark/env` will look for your `CISCOSPARK_ACCESS_TOKEN` to initialize the SDK for you.

If you're still using `ciscospark/env`, the code snippet below shows how to use the SDK when importing/requiring `ciscospark/env`

```javascript
const assert = require(`assert`);
const ciscospark = require(`ciscospark/env`);

assert(process.env.CISCOSPARK_ACCESS_TOKEN, 'This example assumes you have set your access token as an environment variable');

ciscospark.rooms.create({title: `My First Room`})...
````

## Samples

Sample code can be found in [packages/node_modules/samples](./packages/node_modules/samples). You can run them yourself with the following commands:

> Note: this installs all of the SDK's tooling dependencies, so you'll need `libgcrypt` and (possibly) `graphicsmagick`.
> On a mac, you can install these with `brew install graphicsmagick libgcrypt`.

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
