# @webex/internal-plugin-device

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for device management

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-device
```

## Usage

```js
import '@webex/internal-plugin-device';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();

// Namespace.
webex.internal.device

// Register the device.
webex.internal.device.register()
  .then(() => {}) // On successful registration.
  .catch(() => {}); // On failed registration.

// Refresh the device.
webex.internal.device.refresh()
  .then(() => {}) // On successful refresh.
  .catch(() => {}); // On failed refresh.

// Unregister the device.
webex.internal.device.unregister()
  .then(() => {}) // On successful unregistration.
  .catch(() => {}); // On failed unregistration.

// Get the current web socket url. Accepts a boolean to enable waiting for the
// url to populate.
webex.internal.device.getWebSocketUrl(true)
  .then((url) => {}) // Resolves to the url when it is retrievable.
  .catch(() => {}) // Rejects when the url is not available.

// Commonly referenced properties.

// The device's url once registered.
webex.internal.device.url;

// The registered device's user uuid.
webex.internal.device.userId;

// Determines if the device is registered.
webex.internal.device.registered;
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
