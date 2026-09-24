# @webex/kms-caroots

> Generate the Cisco Trusted Root Store CA roots used to validate the Webex KMS certificate.

The Webex SDK validates the KMS certificate chain against a set of trusted CA
roots supplied via `config.encryption.caroots`. The SDK does not ship a bundle,
so that certificate updates don't require an SDK upgrade. This tool downloads the
Cisco Trusted Root Store **Union** bundle, verifies its signature against the
pinned Cisco trust anchors, and decodes it into the `caroots` format (an array of
raw base64-encoded certificates).

See <https://www.cisco.com/security/pki/trs/readme.html> for the Cisco Trusted
Root Store.

Requires the `openssl` binary on `PATH`.

## CLI

```bash
# Print the JSON array to stdout
npx webex-kms-caroots

# Write it to a file
npx webex-kms-caroots --out ./caroots.json
```

## Programmatic

```js
const {generateKmsCaroots} = require('@webex/kms-caroots');

const caroots = await generateKmsCaroots();

const webex = new WebexCore({
  config: {
    encryption: {caroots},
  },
});
```

## License

© 2026 Cisco and/or its affiliates. All Rights Reserved.
