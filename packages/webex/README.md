# Webex

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

# The Cisco Webex JS SDK

> Upgrading from CiscoSpark to Webex?
>
> - [Follow this short guide.](../../../UPGRADING.md)
> - [Read why this is more than just a rebrand.](https://developer.webex.com/blog/the-new-cisco-webex-for-developers-is-here---what-developers-need-to-know-from-our-rebrand)

- [Webex](#webex)
- [The Cisco Webex JS SDK](#the-cisco-webex-js-sdk)
  - [Install](#install)
  - [Usage](#usage)
    - [_A note on browser usage_](#a-note-on-browser-usage)
    - [_Still using `webex/env` or `ciscospark/env`?_](#still-using-webexenv-or-ciscosparkenv)
  - [API](#api)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

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
    access_token: <your webex access token>
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

We provide a built, minified version of the SDK, that includes `window.Webex`. You can access it via [unpkg](https://unpkg.com/) or [jsdelivr](https://jsdelivr.com/).

```html
<!-- unpkg -->
<script src="https://unpkg.com/webex/umd/webex.min.js"></script>
<!-- jsdelivr -->
<script src="https://cdn.jsdelivr.net/npm/webex/umd/webex.min.js"></script>
```

If you're already using a bundler (like [Webpack](https://webpack.js.org/)) you can simply import/require the package and use the above snippet and assign the initialized `webex` variable to `window.webex`.
For a quick example, we'll use [Parcel](https://parceljs.org/) to bundle the SDK for a website. For any more information and questions on how to use Parcel, please head to their [website](https://parceljs.org/).

1. Create `index.js`.

```javascript
import { init as initWebex } from 'webex';

// Initialize the SDK and make it available to the window
const webex = (window.webex = initWebex({
  credentials: {
    access_token: <your webex access token>
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

2. Create `index.html`.

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

#### _[Still using `webex/env` or `ciscospark/env`?](../../../documentation/webex.md#shell-script-quick-start)_

## API

Full API docs are published at the [docs site](https://webex.github.io/webex-js-sdk/api/).

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
