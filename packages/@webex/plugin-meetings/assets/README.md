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
collisions. The SDK does not serve them. Development builds and local builds without an injected SDK
version default to `/assets/plugin-meetings/`, which webpack-dev-server serves from this folder.
SDK release builds default to the matching UMD CDN directory
(`https://unpkg.com/webex@<sdk-version>/umd/assets/plugin-meetings/`). Standalone plugin npm releases
default to the plugin package's assets
(`https://app.unpkg.com/@webex/plugin-meetings@<plugin-version>/files/dist/assets/`). Applications
can override the URL to serve assets from their own origin or CDN.

Use a versioned URL so the JavaScript SDK and its static assets remain compatible. For a CDN URL,
allow the consuming application origin with CORS and serve `e2ee.js` with a
JavaScript MIME type.

`*.map` files are ignored and not copied.
