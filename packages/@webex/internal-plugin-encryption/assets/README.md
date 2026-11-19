<!--
  Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
-->

# internal-plugin-encryption static assets

This folder contains files that internal-plugin-encryption loads at runtime:

- `ios_union-<version>.p7b` — Cisco's signed Trusted Root Store "Union" bundle, named using
  its verified signed version (YYYYMMDD). When
  `encryption.shouldValidateKMSCertificate: true`, on first KMS use the SDK
  downloads it, verifies its CMS signature against the pinned Cisco TRS Bundle Root CA and uses
  the contained certificates as the CA roots for KMS certificate validation (unless
  `encryption.caroots` is configured).

Certificate-chain validation defaults to `false`, so the asset is not loaded
unless the application opts in.

`yarn build:src` copies these files to `packages/@webex/internal-plugin-encryption/dist/assets`.
For UMD/CDN distribution, `yarn build:script` copies them to
`packages/webex/umd/assets/internal-plugin-encryption/`.

The file is signed, so it is safe to commit. To refresh it from Cisco, run:

```bash
yarn workspace @webex/internal-plugin-encryption assets:refresh
```

This verifies the downloaded bundle with the same code the SDK uses at runtime, refuses to
downgrade the bundle version, and generates the asset filename and the matching
constants in `src/union-bundle.js`. The previous shipped bundle is removed after
the replacement is written. Do not rename the asset or edit the constants by hand.
