<!--
  Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
-->

# plugin-meetings static assets

This folder contains files that plugin-meetings loads at runtime:

- `e2ee.js` and `e2ee.wasm` — the Emscripten loader and binary for MLS meetings.
- `domain_name_roots.p7b` — the signed domain-name certificate-root bundle.

`yarn build` copies these files to `dist/assets`. The SDK does not serve them. A consuming
application must host the contents of `dist/assets` at a URL reachable by the browser and set
`meetings.assetsBaseUrl` to that directory. For example, if the files are hosted at
`https://cdn.example.com/webex-js-sdk/1.2.3/plugin-meetings/assets/`, configure that URL as
`assetsBaseUrl`.

Use a versioned URL so the JavaScript SDK and its static assets remain compatible. The default
`assetsBaseUrl` is `/assets/` for applications that serve the files from their own origin.
For a CDN URL, allow the consuming application origin with CORS and serve `e2ee.js` with a
JavaScript MIME type.

`e2ee.wasm.map` is git-ignored. Ensure the release `e2ee.wasm` is present before building or
publishing the package.
