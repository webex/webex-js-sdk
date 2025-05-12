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

## Install

```bash
npm install --save @webex/plugin-encryption
```

## Usage

This is a plugin for the Cisco Webex JS SDK . Please see our [developer portal](https://developer.webex.com/) and the [API reference](https://webex.github.io/webex-js-sdk/plugin-encryption/) for full details.

## API Docs and Sample App

- API Reference: [https://webex.github.io/webex-js-sdk/plugin-encryption/](https://webex.github.io/webex-js-sdk/plugin-encryption/)
- Hosted Sample App: [https://webex.github.io/webex-js-sdk/samples/plugin-encryption/](https://webex.github.io/webex-js-sdk/samples/plugin-encryption/)
- See [https://github.com/webex/webex-js-sdk/tree/next/docs/samples/plugin-encryption](https://github.com/webex/webex-js-sdk/tree/next/docs/samples/plugin-encryption) for a reference implementation

## Sample Code

```typescript
import Webex from 'webex/plugin-encryption';

const webex = Webex.init({
  credentials: {
    access_token
  }
});

webex.once('ready', () => {
  webex.cypher.register().then(() => {
    try {
      const attachmentURL = 'https:/myfileurl.xyz/zzz/fileid?keyUri=somekeyuri&JWE=somejwe';
      const options = {
        useFileService: false,
        jwe: somejwe, // Provide the JWE here if not already present in the attachmentURL
        keyUri: someKeyUri, // Provide the keyURI here if not already present in the attachmentURL
      };
      const decryptedFileBuf = await webex.cypher.downloadAndDecryptFile(attachmentURL, options);
      // Do something with the decrypted file buffer
    } catch (error) {
      // Handle error
    }
  }).catch((err) => {
    // Handle error
  });
});

webex.cypher.deregister().then(() => {
// Do deregistration at your App's teardown
});
```

#### Development

To use `webpack-dev-server` to load this package, run `yarn run samples:serve`.

Files placed in the `docs/samples/plugin-encryption` folder will be served statically.

Files in the `src/@webex/plugin-encryption` folder will be compiled, bundled, and served as a static asset at `encryption.js` inside that directory.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/next/CONTRIBUTING.md) for more details.

## License

This project is licensed under the Cisco General Terms - see the [LICENSE](https://github.com/webex/webex-js-sdk/blob/next/LICENSE.md) for details.

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
