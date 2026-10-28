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

KMS certificate-chain validation is disabled by default. Applications can opt in
to validating the KMS certificate chain against trusted CA roots when negotiating
an ECDH key with the KMS. This is controlled by these
options on the `encryption` config:

- `shouldValidateKMSCertificate` — whether to validate the KMS certificate
  chain. Defaults to `false`; set it to `true` to opt in. When enabled the SDK **fails closed**: if no CA
  roots are available, or the chain doesn't validate, the ECDH negotiation
  fails. When both validation options are disabled, the SDK does not load the
  CA roots asset.
- `shouldValidateKMSCertificateReportOnly` — defaults to `false`. When `true`
  and enforcement is disabled, check the certificate chain in the background
  using configured `caroots` or the same verified asset. Download, bundle
  verification and certificate-chain failures are reported without delaying or
  rejecting KMS setup. Mandatory key/certificate checks still apply. Enforcement
  takes precedence over this option.
- `caroots` — an array of raw base64-encoded CA root certificates. When set (and
  non-empty) these are used and nothing is downloaded in either validation
  mode. Supplying roots alone does not enable validation; select enforcement or
  background report-only checking explicitly.
- `carootsAsset` — the file name of Cisco's signed Trusted Root Store **Union**
  bundle, `ios_union-<version>.p7b`, using the signed bundle version (YYYYMMDD).
- `assetsBaseUrl` — the URL of the directory hosting `carootsAsset`. Versioned
  release builds default to
  `https://unpkg.com/webex@<sdk-version>/umd/assets/internal-plugin-encryption/`,
  using the build-injected version of the containing `webex` package.
  Standalone plugin builds without an SDK version pass their `PACKAGE_VERSION`
  to the shared helper and use
  `https://unpkg.com/@webex/internal-plugin-encryption@<plugin-version>/dist/assets/`.
  Development builds and builds without either version use
  `/assets/internal-plugin-encryption/` on the page's origin. Explicit
  application settings override this default.

### Where the CA roots come from

When enforcement or background report-only checking is enabled:

1. **`caroots`**, when configured.
2. Otherwise, the **Cisco Union bundle** shipped as a static asset with this
   package. It's loaded once, on first KMS use: browsers download it from
   `assetsBaseUrl`, and Node reads the package's own copy (`dist/assets/`). The
   bundle's CMS signature is verified in JavaScript against the pinned Cisco
   TRS Bundle Root CA, and a bundle older than the one shipped with the SDK is
   rejected. Every certificate in the verified bundle is trusted.
3. Enforcement **fails closed** if roots cannot be loaded or verified.
   Background report-only checking reports the asset failure and leaves KMS
   setup unaffected. Failed loads are retried on a later context negotiation.

The new report-only check starts after the mandatory key checks succeed. It
does not delay context setup, even while its download is pending. Certificate
failures use `validationMode: 'report-only'`; download and bundle-verification
failures keep their existing metric categories. An unverified bundle is never
used. A tab or SDK instance closing can prevent background reporting from
completing.

```js
const webex = new WebexCore({
  config: {
    encryption: {
      shouldValidateKMSCertificateReportOnly: true,
      // Optional: override assetsBaseUrl to use application-hosted assets.
    },
  },
});
```

When both flags are `true`, enforcement wins and the report-only option
does not add a duplicate check.

The SDK reports these client metrics:

- `JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED`
- `JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED` (tagged with the reason)
- `JS_SDK_KMS_CAROOTS_ASSET_STALE` (the bundle is more than a year old)
- `JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED`

### Hosting the asset

The encryption plugin owns the default for direct `WebexCore` consumers,
`Webex.init()`, and the encryption UMD bundle. After opting in with
either validation option, versioned release builds fetch the bundle
from the matching `webex` UMD assets on unpkg, so your Content
Security Policy `connect-src` must allow `https://unpkg.com`. Standalone plugin
builds use their own `PACKAGE_VERSION` to fetch the raw asset from the matching
`@webex/internal-plugin-encryption` package's `dist/assets/` directory on unpkg.
Development builds and builds without either version use
`/assets/internal-plugin-encryption/` on the page's origin. Node reads the
packaged file first, regardless of this URL.

The selected `webex` or `@webex/internal-plugin-encryption` release must contain
the versioned `.p7b` asset before its public URL can be used. Verify published
delivery after a release containing the KMS asset is available.

To self-host, serve the files from
`node_modules/@webex/internal-plugin-encryption/dist/assets/` (or
`webex/umd/assets/internal-plugin-encryption/`) and point `assetsBaseUrl` at
that directory. Use a versioned URL so the asset matches the SDK. Allow your
application's origin with CORS when serving from another origin.

If you enable `services.validateCatalogUrls`, requests to URLs outside the
service catalog are blocked, including the asset download. Either add the asset
host (e.g. `unpkg.com`) to `services.allowedDomains`, or supply
`caroots`. The asset request never carries the user's access token.

```js
const webex = new WebexCore({
  config: {
    encryption: {
      shouldValidateKMSCertificate: true,
      assetsBaseUrl: 'https://cdn.example.com/webex-js-sdk/1.2.3/internal-plugin-encryption/',
    },
  },
});
```

### Offline, FedRAMP and locked-down deployments

If the application can't fetch the asset, supply `caroots` and explicitly set
`shouldValidateKMSCertificate: true` to enforce validation. Generate the roots
with the [`@webex/kms-caroots`](https://github.com/webex/webex-js-sdk/tree/master/packages/%40webex/kms-caroots)
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
const webex = new WebexCore({
  config: {encryption: {shouldValidateKMSCertificate: true, caroots}},
});
```

Each `caroots` entry is the raw base64-encoded certificate (the DER body,
without the `-----BEGIN/END CERTIFICATE-----` lines or newlines).

### Refreshing the shipped bundle

Maintainers refresh `assets/ios_union-<version>.p7b` with
`yarn workspace @webex/internal-plugin-encryption assets:refresh`, which
downloads the latest bundle from Cisco, verifies it, refuses to downgrade it,
names the file using its verified signed version, and regenerates
`src/union-bundle.js` with the matching filename and rollback floor. The previous
shipped bundle is removed after the replacement is written. Both the asset name
and version are generated; do not edit them by hand.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
