<!--
  Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
-->

# plugin-meetings static assets

This folder contains files that plugin-meetings loads at runtime:

- `e2ee.js` and `e2ee.wasm` — the Emscripten loader and binary for MLS join to E2EE meetings.

`yarn build` copies these files to `dist/assets`; `yarn build:script` copies them to
`packages/webex/umd/assets` for UMD/CDN distribution. The SDK does not serve them. A consuming
application must host the assets at a URL reachable by the browser and set `meetings.assetsBaseUrl`
to that directory. For npm package assets, use a URL such as
`https://cdn.example.com/webex-js-sdk/1.2.3/plugin-meetings/assets/`; for UMD assets, use
`https://cdn.example.com/webex-js-sdk/1.2.3/umd/assets/`.

Use a versioned URL so the JavaScript SDK and its static assets remain compatible. The default
`assetsBaseUrl` is `/assets/` for applications that serve the files from their own origin.
For a CDN URL, allow the consuming application origin with CORS and serve `e2ee.js` with a
JavaScript MIME type.

`*.map` files are ignored and not copied.
