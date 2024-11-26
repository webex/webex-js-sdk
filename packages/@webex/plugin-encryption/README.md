# @webex/plugin-encryption

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Encryption plugin for the Cisco Webex JS SDK.

- [Install](#install)
- [Usage](#usage)
- [Development](#development)
- [Sample Code](#sample-code)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

# WARNING: This plugin is currently under active development

## Install

```bash
npm install --save @webex/plugin-encryption
```

## Usage

This is a plugin for the Cisco Webex JS SDK . Please see our [developer portal](https://developer.webex.com/) and the [API docs](https://webex.github.io/webex-js-sdk/api/) for full details.

## API Docs and Sample App

API Docs: <https://webex.github.io/webex-js-sdk/api/>
Hosted Sample App: <https://webex.github.io/webex-js-sdk/samples/plugin-encryption/>
See <https://github.com/webex/webex-js-sdk/tree/master/docs/samples/plugin-encryption> for the sample app code vs the readme

## Sample Code

```typescript
import { decryptAttachment } from '@webex/plugin-encryption';
import { Webex } from '@webex/core';

const webex = new Webex({
  credentials: {
    access_token
  }
});

try {
  const decryptedFile = await webex.encryption.decryptAttachment(attachmentURL);
  // Do something with the decrypted file
} catch (error) {
  // Handle error
}
```

#### Development

To use `webpack-dev-server` to load this package, run `yarn run samples:serve`.

Files placed in the `docs/samples/plugin-encryption` folder will be served statically.

Files in the `src` folder will be compiled, bundled, and served as a static asset at `bundle.js` inside that directory.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
