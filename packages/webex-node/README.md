# webex-node

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

# The Cisco Webex JS SDK for Node.js

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
npm install --save webex-node
(or)
yarn add webex-node
```

## Usage

To use the SDK, you will need Cisco Webex credentials. If you do not already have a Cisco Webex account, visit
[Cisco Webex for Developers](https://developer.webex.com/) to create your account and retrieve your **_access token_**.

See [the detailed docs](https://webex.github.io/webex-js-sdk/) for more usage examples.

```javascript
const Webex = require(`webex-node`);
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

This package is not meant to be used on browsers.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
