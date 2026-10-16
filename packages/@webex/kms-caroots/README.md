# @webex/kms-caroots

> Provide and generate the CA roots used to validate the Webex KMS certificate.

The Webex SDK validates the KMS certificate chain against a set of trusted CA
roots supplied via `config.encryption.caroots`. The SDK ships a generated bundle
containing the roots shared by the Cisco Trusted Root Store **Union** bundle and
Mozilla's TLS server trust store. The generator verifies the Cisco bundle against
pinned Cisco trust anchors before filtering it against Mozilla NSS `certdata.txt`.
Verification excludes OpenSSL's default CA locations, so the downloaded Cisco
bundle must chain to the pinned anchors.

See <https://www.cisco.com/security/pki/trs/readme.html> for the Cisco Trusted
Root Store.

Requires the `openssl` binary on `PATH`.

## Bundled roots

The package's default export is the generated root array. The SDK uses this
export automatically, while applications can also import it directly:

```js
const caroots = require('@webex/kms-caroots').default;
```

Maintainers can refresh `caroots.js` from this repository with:

```bash
yarn workspace @webex/kms-caroots build:src
```

## CLI

For a one-time run in a consuming application, invoke the published scoped
package directly:

```bash
# Print the JSON array to stdout
npx @webex/kms-caroots

# Write it to a file
npx @webex/kms-caroots --out ./caroots.json
```

Applications that need to refresh roots independently of an SDK release can
install `@webex/kms-caroots` as a development dependency and run its
`webex-kms-caroots` binary, then supply the resulting JSON array as
`config.encryption.caroots`:

```bash
npm install --save-dev @webex/kms-caroots
npx webex-kms-caroots --out ./caroots.json
```

From this repository's root, use `yarn caroots:generate --out ./caroots.json`.

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
