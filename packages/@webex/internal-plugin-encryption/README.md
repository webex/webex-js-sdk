# @webex/internal-plugin-encryption

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Encryption and KMS services

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-encryption
```

## Usage

```js
import '@webex/internal-plugin-encryption';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.encryption.WHATEVER;
```

## KMS certificate validation

When the SDK negotiates an ECDH key with the KMS, it validates the KMS
certificate chain against a set of trusted CA roots. This is controlled by these
options on the `encryption` config:

- `shouldValidateKMSCertificate` — whether to validate the KMS certificate
  chain. Defaults to `true`. When enabled the SDK **fails closed**: if no CA
  roots are available, or the chain doesn't validate, the ECDH negotiation
  fails. Set to `false` to opt out of validation.
- `caroots` — an array of raw base64-encoded CA root certificates. When set (and
  non-empty) these are used and nothing is downloaded.
- `carootsAsset` — the file name of Cisco's signed Trusted Root Store **Union**
  bundle, `ios_union.p7b`.
- `assetsBaseUrl` — the URL of the directory hosting `carootsAsset`. Defaults to
  `/assets/internal-plugin-encryption/` on the page's origin. The `webex`
  package sets it to the matching versioned copy on jsDelivr,
  `https://cdn.jsdelivr.net/npm/webex@<version>/umd/assets/internal-plugin-encryption/`.
- `carootsReportOnly` — an additional array of CA roots validated alongside the
  enforced roots. A failure here is only reported as a metric instead of failing
  the negotiation, which lets a new bundle be trialled in parallel.

### Where the CA roots come from

1. **`caroots`**, when configured.
2. Otherwise, the **Cisco Union bundle** shipped as a static asset with this
   package. It's loaded once, on first KMS use: browsers download it from
   `assetsBaseUrl`, and Node reads the package's own copy (`dist/assets/`). The
   bundle's CMS signature is verified in JavaScript against the pinned Cisco
   TRS Bundle Root CA, and a bundle older than the one shipped with the SDK is
   rejected. Every certificate in the verified bundle is trusted.
3. If neither is available the negotiation **fails closed** with an error that
   names `caroots`, `assetsBaseUrl` and `shouldValidateKMSCertificate`. A failed
   download or verification is retried on the next KMS request.

The SDK reports these client metrics:

- `JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED`
- `JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED` (tagged with the reason)
- `JS_SDK_KMS_CAROOTS_ASSET_STALE` (the bundle is more than a year old)
- `JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED`

### Hosting the asset

Applications using the `webex` package (npm or UMD) need no configuration:
the bundle is fetched from jsDelivr. Make sure your Content Security Policy
`connect-src` allows `https://cdn.jsdelivr.net`.

To self-host, serve the files from
`node_modules/@webex/internal-plugin-encryption/dist/assets/` (or
`webex/umd/assets/internal-plugin-encryption/`) and point `assetsBaseUrl` at
that directory. Use a versioned URL so the asset matches the SDK. Allow your
application's origin with CORS when serving from another origin.

If you enable `services.validateCatalogUrls`, requests to URLs outside the
service catalog are blocked, including the asset download. Either add the asset
host (e.g. `cdn.jsdelivr.net`) to `services.allowedDomains`, or supply
`caroots`. The asset request never carries the user's access token.

```js
const webex = new WebexCore({
  config: {
    encryption: {
      assetsBaseUrl: 'https://cdn.example.com/webex-js-sdk/1.2.3/internal-plugin-encryption/',
    },
  },
});
```

### Offline, FedRAMP and locked-down deployments

If the application can't fetch the asset, supply `caroots` instead. Generate
them with the [`@webex/kms-caroots`](https://github.com/webex/webex-js-sdk/tree/master/packages/%40webex/kms-caroots)
package, which verifies the Cisco Union bundle with the same code the SDK uses
at runtime (no `openssl` required) and decodes it into the `caroots` format:

```bash
# Download and verify the latest bundle from Cisco
npx @webex/kms-caroots --out ./caroots.json

# Or verify a bundle you already have
npx @webex/kms-caroots --in ./ios_union.p7b --out ./caroots.json
```

```js
const {generateKmsCaroots} = require('@webex/kms-caroots');

const caroots = await generateKmsCaroots();
const webex = new WebexCore({config: {encryption: {caroots}}});
```

Each `caroots` entry is the raw base64-encoded certificate (the DER body,
without the `-----BEGIN/END CERTIFICATE-----` lines or newlines).

### Refreshing the shipped bundle

Maintainers refresh `assets/ios_union.p7b` with
`yarn workspace @webex/internal-plugin-encryption assets:refresh`, which
downloads the latest bundle from Cisco, verifies it, refuses to downgrade it and
regenerates `src/union-bundle.js`.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
