# @webex/kms-caroots

> Verify the Cisco Trusted Root Store bundle and generate the CA roots used to
> validate the Webex KMS certificate.

The Webex SDK can validate the KMS certificate chain against the CA roots in Cisco's
signed Trusted Root Store **Union** bundle (`ios_union.p7b`). Certificate-chain
validation defaults to `false`; enable it with
`config.encryption.shouldValidateKMSCertificate: true`. Once enabled, the SDK
loads the bundle as a static asset and verifies it at runtime unless roots are
supplied, so most applications don't need this package. Use it when you want to supply
`config.encryption.caroots` yourself, e.g. for offline, FedRAMP or locked-down
(CSP) deployments that can't fetch the SDK's static assets.

The bundle's CMS signature is verified in JavaScript (Node or browser, no
`openssl` required) against the pinned Cisco **TRS Bundle Root CA**
(SHA-256 `DE:C6:69:E3:22:E0:7C:D7:C6:0A:56:90:4B:F5:0C:29:FA:1E:75:07:17:23:FC:10:35:77:E2:7B:22:69:68:D5`).
Certificates embedded in the bundle are never trusted as anchors. The chain is
checked at the bundle's signed `signingTime`, because Cisco's signing certificate
is only valid for a year. Every certificate in the verified bundle is returned.

See <https://www.cisco.com/security/pki/trs/readme.html> for the Cisco Trusted
Root Store.

## CLI

For a one-time run in a consuming application, invoke the published scoped
package directly:

```bash
# Download, verify and print the JSON array to stdout
npx @webex/kms-caroots

# Write it to a file
npx @webex/kms-caroots --out ./caroots.json

# Verify a bundle you already have instead of downloading it
npx @webex/kms-caroots --in ./ios_union.p7b --out ./caroots.json
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

const caroots = await generateKmsCaroots(); // or generateKmsCaroots({input: './ios_union.p7b'})

const webex = new WebexCore({
  config: {
    encryption: {shouldValidateKMSCertificate: true, caroots},
  },
});
```

The verifier itself is browser-safe and network-free. It is also the package's
`browser` entry, so bundlers resolve `@webex/kms-caroots` to it:

```js
const {verifyUnionBundle} = require('@webex/kms-caroots/verify');

const {caroots, bundleVersion, signingTime} = await verifyUnionBundle(bytes, {
  minBundleVersion: 20261022, // optional rollback protection (YYYYMMDD)
});
```

It rejects with a `UnionBundleVerificationError` whose `reason` is one of
`parse`, `attributes`, `signature`, `name`, `version`, `signing-time` or
`no-certificates`.

## License

© 2026 Cisco and/or its affiliates. All Rights Reserved.
