# Encryption UMD asset regression tests

From the repository root, install dependencies with `yarn install`. Install Google Chrome if it is not already available. Then run:

```sh
yarn workspace webex test:browser
```

The tests build the real production encryption UMD bundle twice: once with a fixed SDK version and once with version `0.0.0`. Each build uses temporary copies of the source and package manifests. The checkout's version numbers and generated bundles are not changed.

Chrome loads each emitted bundle. The tests check the default asset URL, application URL overrides, the default-off certificate-validation setting, and the emitted `.p7b` bytes. Page requests are intercepted locally, so the tests need no credentials or CDN access. The repository's existing browser CI job runs this package command when `webex` changes.

Build logs and observed browser configuration are attached to the Playwright results. Failed tests retain a browser trace under `packages/webex/reports/browser-assets/`.
