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

KMS certificate-chain enforcement is disabled by default. Configure enforcement
and an optional report-only asset source independently:

```js
const webex = new WebexCore({
  config: {
    encryption: {
      shouldValidateKMSCertificate: true,
      assetsBaseUrl: 'https://trusted.example.com/sdk/roots/',
      reportOnlyAssetsBaseUrl: 'https://candidate.example.com/sdk/roots/',
    },
  },
});
```

The enforced check must succeed before KMS setup can continue. The independent
report-only check runs in the background after mandatory and enforced key
validation succeed. Its download, bundle-verification and chain failures report
metrics without delaying or rejecting setup. A tab or SDK instance closing can
prevent a late background report from completing.

### Configuration

- `shouldValidateKMSCertificate` defaults to `false`. Set it to `true` to enforce
  chain trust. Missing roots, download/verification failures and untrusted chains
  reject setup. Mandatory key metadata, name and public-key checks always apply.
- `caroots` is an optional nonempty array of raw base64-encoded certificates.
  These override the enforced asset source. Supplying this array alone does not
  enable enforcement and does not change the separate report-only source.
- `assetsBaseUrl` selects the directory for the enforced `carootsAsset`. Browsers
  load from this URL; Node first uses the file shipped with the package.
- `reportOnlyAssetsBaseUrl` defaults to `undefined`. Supplying a URL enables a
  separate background check against `carootsAsset` loaded from that directory.
  This URL is honored in both browsers and Node; provided `caroots` and Node's
  packaged enforced bundle do not replace it. It works with enforcement enabled
  or disabled. Omitted, `null` and empty-string values disable this new check.
- `carootsAsset` is the filename of Cisco's signed Trusted Root Store Union
  bundle, `ios_union-<version>.p7b`. Both asset directories resolve this same
  filename. To trial different bundles, host the respective signed bundles under
  that filename in separate directories.
- `carootsReportOnly` retains its existing explicit-array check. This check is
  awaited and failures report a metric without rejecting setup. A truthy value,
  including an empty array, takes precedence over `reportOnlyAssetsBaseUrl`.
  Existing callers therefore retain their array selection and timing behavior.

No additional report-only boolean is needed: supplying the report-only URL
enables its check. When enforcement is disabled and neither a report-only URL
nor a legacy array is supplied, no root asset is loaded.

| Enforced configuration                 | Report-only configuration | Behavior                                                           |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Disabled                               | URL supplied              | Load and check that asset in the background                        |
| Provided roots and enforcement enabled | URL supplied              | Enforce the provided roots; independently trial the fetched roots  |
| Asset source and enforcement enabled   | Different URL supplied    | Enforce the primary asset; independently trial the candidate asset |
| Enforcement enabled                    | No report-only source     | Enforce only                                                       |
| Disabled                               | No report-only source     | Mandatory key checks only; no chain check or asset fetch           |

Enforced failures stop setup before the additional check starts. Asset download,
verification and staleness metrics carry `validationMode: 'enforced'` or
`'report-only'`; chain failures use the same tag on
`JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED`.

### Asset verification and caching

Both asset sources use the existing JavaScript verifier. It checks the CMS
signature against the pinned Cisco TRS Bundle Root CA and rejects a signed
bundle version older than the SDK's rollback floor. Unverified roots are never
used. Every certificate in a verified bundle is trusted.

Verified roots are cached by directory URL, asset filename and source/transport.
Concurrent checks of the same source share the pending load. Different URLs and
Node's packaged-versus-explicit-URL sources stay separate. Failed loads are
removed so a later check can retry; a caught background failure cannot make
an enforced load succeed.

The SDK reports these metrics:

- `JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED`
- `JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED`
- `JS_SDK_KMS_CAROOTS_ASSET_STALE`
- `JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED`

### Hosting the assets

Versioned SDK releases default the enforced `assetsBaseUrl` to
`https://unpkg.com/webex@<sdk-version>/umd/assets/internal-plugin-encryption/`.
Standalone plugin builds use
`https://unpkg.com/@webex/internal-plugin-encryption@<plugin-version>/dist/assets/`.
Unversioned development builds use `/assets/internal-plugin-encryption/` on the
page's origin. Applications can override this directory. The report-only source
has no default URL; opt in with an explicit directory.

To self-host, serve the files from
`node_modules/@webex/internal-plugin-encryption/dist/assets/` or
`webex/umd/assets/internal-plugin-encryption/`. Use versioned directories, allow
the hosting origin in the application's Content Security Policy `connect-src`,
and configure CORS when serving across origins. Confirm that the selected
published release contains the requested asset before using its public URL.

If `services.validateCatalogUrls` is enabled, add each asset host to
`services.allowedDomains`. Asset requests suppress the user's access token and
SDK custom headers. Node's enforced packaged-file behavior is unchanged; an
explicit report-only URL always uses the URL loader.

To use the same hosted bundle only for reporting:

```js
const webex = new WebexCore({
  config: {
    encryption: {
      reportOnlyAssetsBaseUrl: '/assets/internal-plugin-encryption/',
    },
  },
});
```

To enforce one supplied root set while trialling a fetched bundle:

```js
const webex = new WebexCore({
  config: {
    encryption: {
      shouldValidateKMSCertificate: true,
      caroots: trustedRoots,
      reportOnlyAssetsBaseUrl: 'https://candidate.example.com/sdk/roots/',
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
