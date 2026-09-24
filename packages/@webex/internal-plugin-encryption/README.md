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
configuration options on the `encryption` config:

- `shouldValidateKMSCertificate` — whether to validate the KMS certificate
  chain. Defaults to `true` as a secure default. When enabled the SDK **fails
  closed**: a `caroots` bundle must be configured and the chain must validate
  against it, otherwise the ECDH negotiation fails. Set to `false` to
  temporarily opt out of validation, for example while upgrading and wiring up
  the CA root bundle.
- `caroots` — an array of raw base64-encoded CA root certificates. Required when
  `shouldValidateKMSCertificate` is `true`.
- `carootsReportOnly` — an additional array of CA roots validated alongside
  `caroots`. A failure here is only reported as a metric instead of failing the
  negotiation, which lets a new bundle be trialled in parallel with the enforced
  `caroots`.

Supplying the CA roots is the responsibility of the consuming application. The
SDK does not ship a bundle, so that certificate updates don't require an SDK
upgrade. Cisco first-party clients should source their roots from the Cisco
Trusted Root Store, using the **Union** bundle:
<https://www.cisco.com/security/pki/trs/readme.html>

### Generating the CA roots

Use the [`@webex/kms-caroots`](https://github.com/webex/webex-js-sdk/tree/master/packages/%40webex/kms-caroots)
package, which downloads the Cisco Union bundle, verifies its signature against
the pinned Cisco trust anchors, and decodes it into the `caroots` format (an
array of raw base64-encoded certificates). It requires the `openssl` binary on
`PATH`.

```bash
# Print the JSON array to stdout
npx webex-kms-caroots

# Or write it to a file
npx webex-kms-caroots --out ./caroots.json
```

```js
const {generateKmsCaroots} = require('@webex/kms-caroots');

const caroots = await generateKmsCaroots();
const webex = new WebexCore({config: {encryption: {caroots}}});
```

The SDK itself does no file or network I/O to obtain roots — supplying them is a
build/config concern for the consuming application (important since a prebuilt
library cannot read files in the browser).

The SDK's own integration/browser tests generate these roots automatically: the
test runner (`@webex/legacy-tools`) calls `@webex/kms-caroots` and configures
webex-core before the tests run, so the KMS certificate is validated against the
real trust store.

### Configuring manually

The referenced Cisco page is authoritative for how to download, verify, and
extract the bundle. Each `caroots` entry is the raw base64-encoded certificate
(the DER body, without the `-----BEGIN/END CERTIFICATE-----` lines or newlines):

```js
import '@webex/internal-plugin-encryption';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore({
  config: {
    encryption: {
      // Raw base64-encoded certificates extracted from the Cisco Union bundle
      caroots: [
        'MIIF8TCCA9mgAwIBAgIIVE2lvEA1VlowDQYJKoZIhvcNAQELBQAw...',
        // ...additional roots
      ],
    },
  },
});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
