# @webex/plugin-device-manager

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the DeviceManager service

# WARNING: This plugin is currently under active development, is not stable, and breaking changes can and will happen!

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/plugin-device-manager
```

## Usage

This is a plugin for the Cisco Webex JS SDK . Please see our [developer portal](https://developer.webex.com/) and the [API docs](https://webex.github.io/webex-js-sdk/api/) for full details.

###Samples

```
npm run samples:devicemanager
```

// initialize webex instance -> connects to mercury -> registers device ->
// initializes plugin-device-manager to listen for device updates

```javascript
import '@webex/plugin-device-manager';
import WebexCore from '@webex/webex-core';
function connect() {
  if (!webex) {
    webex = WebexCore.init({
      config: {},
      credentials: {
        access_token: document.getElementById('access-token').value,
      },
    });
  }
  if (!webex.internal.device.registered) {
    webex.internal.device.register().then(() => {
      return webex.internal.mercury.connect();
    });
  }
}

// Typical flow
webex.devicemanager
  .getAll() // gets a list of all devices registered to the user
  .refresh() // refreshes and re-populates all devices registered to the user
  .search() // search a device by name
  .requestPin() // displays PIN Challenge on the device
  .pair() // pairs the device and registers for subsequent fetches
  .increaseVolume() // increases paired device's volume
  .decreaseVolume() // decreases paired device's volume
  .mute() // mutes the paired device
  .unmute() // unmutes the paired device
  .bindSpace() // binds the space to the paired device
  .unbindSpace() // unbinds the space to the paired device
  .unpair(); // disconnects the device paired session
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
