# @webex/plugin-encryption

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

# Encryption plugin for the Cisco Webex JS SDK

- [Install](#install)
- [Usage](#usage)
- [KMS certificate validation](#kms-certificate-validation)
- [API Docs and Sample App](#api-docs-and-sample-app)
- [Sample Code](#sample-code)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/plugin-encryption
```

In addition to the module consumption via NPMJS, this module can also be consumed via our CDN. See the below examples of how to consume this via CDN:

```html
<html>
  <head>
    <!-- via unpkg -->
    <script crossorigin src="https://unpkg.com/webex@latest/umd/encryption.min.js"></script>

    <!-- via jsdelivr -->
    <script crossorigin src="https://cdn.jsdelivr.net/npm/webex/umd/encryption.min.js"></script>
  </head>
  <!-- ...application html... -->
</html>
```

## Usage

This is a plugin for the Cisco Webex JS SDK. Please see our [developer portal](https://developer.webex.com/) and the [API reference](https://webex.github.io/webex-js-sdk/plugin-encryption/) for full details.

## KMS certificate validation

KMS certificate-chain validation is disabled by default. To enable it, set
`config.encryption.shouldValidateKMSCertificate` to `true`. For example, with
trusted CA roots supplied by your application:

```js
const webex = Webex.init({
  config: {
    encryption: {
      shouldValidateKMSCertificate: true,
      caroots, // Array of raw base64-encoded CA root certificates.
    },
  },
  credentials: {access_token},
});
```

Supplying `caroots` alone does not enable validation. Once enabled, validation
fails closed if trusted roots cannot be loaded or the KMS certificate chain is
untrusted. If roots are not supplied, the SDK loads and verifies its signed CA
roots asset. See the [KMS configuration and asset-hosting guide](../internal-plugin-encryption/README.md#kms-certificate-validation)
for download configuration and offline deployments.

To observe a separate signed root bundle, set
`config.encryption.reportOnlyAssetsBaseUrl` to its asset directory. This option
has no default URL. It starts a background check after mandatory and enforced
validation succeed. Download, verification and chain failures report metrics
without delaying or rejecting setup. It works while enforcement is enabled,
including when `caroots` supplies a different enforced root set. The explicit URL
is honored in both browsers and Node.

Existing `carootsReportOnly` arrays retain their awaited behavior and take
precedence over the new report-only URL. See the configuration guide above for
asset filenames, verification, source caching and background-reporting limits.

## API Docs and Sample App

- API Reference: [https://webex.github.io/webex-js-sdk/plugin-encryption/](https://webex.github.io/webex-js-sdk/plugin-encryption/)
- Hosted Sample App: [https://webex.github.io/webex-js-sdk/samples/plugin-encryption/](https://webex.github.io/webex-js-sdk/samples/plugin-encryption/)
- See [https://github.com/webex/webex-js-sdk/tree/next/docs/samples/plugin-encryption](https://github.com/webex/webex-js-sdk/tree/next/docs/samples/plugin-encryption) for a reference implementation

## Sample Code

```typescript
import Webex from '@webex/plugin-encryption';

const webex = Webex.init({
  credentials: {
    access_token
  }
});

webex.once('ready', () => {
  webex.cypher.register().then(async () => {
    try {
      const attachmentURL = 'https://myfileurl.xyz/zzz/fileid?keyUri=somekeyuri&JWE=somejwe';
      const options = {
        useFileService: false,
        jwe: somejwe, // Provide the JWE here if not already present in the attachmentURL
        keyUri: someKeyUri, // Provide the keyURI here if not already present in the attachmentURL
        headers: {Authorization: `Bearer ${downloadToken}`}, // Optional download headers
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

Use `useFileService: false` to download directly from a custom HTTPS URL. The SDK
forwards only the `Authorization` header from `headers`. Header names are
case-insensitive. Other supplied headers are ignored. Set `useFileService: true` to resolve
the download URL through the Webex file service. The allowed header is sent to the
resolved download URL. It is not sent to KMS or to the file service URL resolver.
Omit `headers` for a presigned URL that does not need them.

### Decrypt file bytes

Use `decryptFile` when your application already has the encrypted file bytes.
Supply both `jwe` and `keyUri` in the options. This method accepts an
`ArrayBuffer`, a `Uint8Array`, a `Blob` (including a `File`), or a Node.js `Buffer`.
It returns the decrypted bytes as an `ArrayBuffer`. It can fetch the key from
KMS, but it does not download the file.

```typescript
import type {FileDecryptionOptions} from '@webex/plugin-encryption';

const options: FileDecryptionOptions = {jwe, keyUri};
const decryptedFileBuf = await webex.cypher.decryptFile(encryptedFileBytes, options);
const file = new File([decryptedFileBuf], 'decrypted-file.jpeg', {type: 'image/jpeg'});
```

## Development

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
