# webex-js-sdk

[![Greenkeeper badge](https://badges.greenkeeper.io/webex/webex-js-sdk.svg)](https://greenkeeper.io/)

[![npm](https://img.shields.io/npm/v/webex.svg?maxAge=86400)](https://www.npmjs.com/package/webex)
[![license](https://img.shields.io/github/license/webex/webex-js-sdk.svg)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
[![Build status](https://ci.appveyor.com/api/projects/status/tb1i5vdhy5e3xsgv/branch/master?svg=true)](https://ci.appveyor.com/project/ianwremmel/webex-js-sdk/branch/master)

# The Cisco Webex JS SDK

> Upgrading from Cisco Spark to Webex?
> - [Follow this short guide.](UPGRADING.md)
> - [Read why this is more than just a rebrand.](https://developer.webex.com/blog/blog-details-9738.html)

This is a monorepo containing all officially maintained Cisco Webex JS SDK modules in the same repo.
[webex](/packages/node_modules/webex) is a collection of node modules targeting our [external APIs](https://developers.webex.com).

- [webex-js-sdk](#webex-js-sdk)
- [The Cisco Webex JS SDK](#the-cisco-webex-js-sdk)
  - [Install](#install)
  - [Usage](#usage)
      - [_A note on browser usage_](#a-note-on-browser-usage)
      - [_Still using `webex/env` or `ciscospark/env`?_](#still-using-webexenv-or-ciscosparkenv)
  - [Samples](#samples)
  - [Contribute](#contribute)
  - [License](#license)

## Install

We test against the [Active LTS](https://github.com/nodejs/Release#release-schedule) (Long Term Support) version of Node.js and use **npm@6** to run [security audits](https://docs.npmjs.com/getting-started/running-a-security-audit).

To install the latest stable version of the SDK from NPM:

```bash
npm install --save webex
```

## Usage

To use the SDK, you will need Cisco Webex credentials. If you do not already have a Cisco Webex account, visit
[Cisco Webex for Developers](https://developer.webex.com/) to create your account and retrieve your **_access token_**.

See [the detailed docs](https://webex.github.io/webex-js-sdk/) for more usage examples.

```javascript
const Webex = require(`webex`);
const webex = Webex.init({
  credentials: {
    access_token: <your webex teams access token>
  }
});

// Create a room with the title "My First Room"
// Add Alice and Bob to the room
// Send a **Hi Everyone** message to the room
webex.rooms.create({ title: `My First Room` }).then(room => {
  return Promise.all([
    webex.memberships.create({
      roomId: room.id,
      personEmail: `alice@example.com`
    }),
    webex.memberships.create({
      roomId: room.id,
      personEmail: `bob@example.com`
    })
  ]).then(() =>
    webex.messages.create({
      markdown: `**Hi Everyone**`,
      roomId: room.id
    })
  );
});
```

#### _A note on browser usage_

If you're already using a bundler (like [Webpack](https://webpack.js.org/) or [Rollup](https://rollupjs.org/)) you can simply import/require the package and use the above snippet and assign the initialized `webex` variable to `window.webex`.
For a quick example, we'll use [Parcel](https://parceljs.org/) to bundle the SDK for a website. For any more information and questions on how to use Parcel, please head to their [website](https://parceljs.org/).

1. Create `index.js`.

```javascript
import { init as initWebex } from 'webex';

// Initialize the SDK and make it available to the window
const webex = (window.webex = initWebex({
  credentials: {
    access_token: <your webex teams access token>
  }
}));

// Create a room with the title "My First Room"
webex.rooms
  .create({
    title: 'My First Room!'
  })
  .catch((error) => {
    console.error(error);
  });

// Filter for "My First Room" from the last 10 rooms
webex.rooms
  .list({
    max: 10
  })
  .then((rooms) => {
    // Destructure room properties for its id (aliased to roomId) and title
    const { id: roomId, title } = rooms.items.filter(
      room => room.title === 'My First Room!'
    )[0];

    // Post message "Hello World!" to "My First Room!"
    webex.messages.create({
      roomId,
      text: 'Hello World!'
    });

    // Log the the room name and the message we created
    return webex.messages
      .list({ roomId, max: 1 })
      // Destructure promised value to get the text property from the first item in items array
      .then(({ items: [{ text }] }) =>
        console.log(`Last message sent to room "${title}": ${text}`)
      );
  })
  .catch((error) => {
    console.error(error);
  });
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

#### _[Still using `webex/env` or `ciscospark/env`?](documentation/webex.md#shell-script-quick-start)_

## Samples

Sample code can be found in [packages/node_modules/samples](./packages/node_modules/samples). You can run them yourself with the following commands:

> Note: This installs all of the SDK's tooling dependencies, so you'll need `libgcrypt` and (possibly) `graphicsmagick`.
> On a mac, you can install these with `brew install graphicsmagick libgcrypt`.

```bash
git clone git@github.com:webex/webex-js-sdk.git
cd webex-js-sdk
npm install
npm run samples:serve
```

Samples | localhost | Hosted
--- | --- | ---
[Samples code](./packages/node_modules/samples/) | https://localhost:8000/ | https://js.samples.s4d.io/

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more details about building the packages
and submitting pull requests for suggested changes.

## License

© 2016-2019 Cisco and/or its affiliates. All Rights Reserved.

See [LICENSE](LICENSE) for details.
