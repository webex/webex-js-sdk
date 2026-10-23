<!--
  Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
-->

# plugin-meetings static assets

This folder contains files that plugin-meetings loads at runtime:

- `e2ee-x.x.x.js` and `e2ee-x.x.x.wasm` — the Emscripten loader and binary for MLS join to E2EE meetings. Filenames need to be unique for each version of the WASM module.

`yarn build` copies these files to `packages/@webex/plugin-meetings/dist/assets`. For UMD/CDN
distribution, `yarn build:script` copies them to
`packages/webex/umd/assets/plugin-meetings/`. Each plugin keeps its own source `assets/` folder;
the UMD build preserves that separation under `umd/assets/<plugin-name>/` to avoid filename
collisions. The SDK does not serve them. A consuming application must host the assets at a URL
reachable by the browser and set `meetings.assetsBaseUrl` to that directory. For npm package assets,
use a URL such as `https://cdn.example.com/webex-js-sdk/1.2.3/plugin-meetings/assets/`; for UMD
assets, use `https://cdn.example.com/webex-js-sdk/1.2.3/umd/assets/plugin-meetings/`.

Use a versioned URL so the JavaScript SDK and its static assets remain compatible. The default
`assetsBaseUrl` defaults to `/assets/plugin-meetings/` for applications that serve the files from
their own origin.
For a CDN URL, allow the consuming application origin with CORS and serve `e2ee.js` with a
JavaScript MIME type.

`*.map` files are ignored and not copied.
