# e2ee WASM artifacts

This folder holds the WebAssembly module that powers end-to-end-encrypted (MLS)
meetings:

- `e2ee.js` — Emscripten module loader (an ES module exporting a default factory).
- `e2ee.wasm` — the compiled WebAssembly binary (built from `libe2ee`).
- `e2ee.wasm.map` — DWARF source map for the binary (debug builds only).

## How these files are consumed

`plugin-meetings` does not serve static files itself. At runtime the generic
[`WasmLoader`](../src/common/wasm-loader.ts) dynamically imports `e2ee.js` and
loads `e2ee.wasm` from a URL (the E2EE module uses `E2EE_WASM_URL`, default
`/wasm/e2ee.wasm`). The **consuming application** is responsible for serving
these files at that URL — typically by copying this folder into its static
output during its own build (e.g. via `copy-webpack-plugin`).

`WasmLoader` identifies each module by its `.wasm` URL (the `.js` loader path is
derived from it by replacing `.wasm`), so the served location is changed by
passing a different URL to `get(wasmUrl)` / `preload(wasmUrl)`.

## Git / size note

`e2ee.wasm` from a debug build is very large (~130 MB, with embedded DWARF), so
`e2ee.wasm` and `e2ee.wasm.map` are git-ignored here and must be placed into this
folder out-of-band (built from `libe2ee`) before serving. Only `e2ee.js` is
tracked. For production, use a size-optimized release build and/or host the
binary on a CDN rather than shipping it in the npm package.
