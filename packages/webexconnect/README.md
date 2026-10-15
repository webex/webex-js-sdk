# @webex/webexconnect

The Webex Connect JavaScript SDK, moved from the `wxconnect-js-sdk` repository into this
monorepo **unmodified**. The source files (`src/IMIClient.js`, `src/aes.js`,
`src/mqttws31.js`, `sw/sw.js`) are byte-for-byte copies of the originals.

This is the **single, canonical copy** of the SDK source in the monorepo. The Webex
Connect sample under `docs/samples/webexconnect/` no longer vendors its own copy — it loads
the built bundle produced here (see [Sample app](#sample-app)). When de-duplicating, the
newer of the two previously-drifted copies was adopted as canonical (`IMIClient.js` +
`sw/sw.js` — same `JS_SDK_VERSION` string, but with the later push-routing/FCM-support and
service-worker fixes).

## Runtime dependency: jQuery

This package has one runtime dependency that is **not** managed by its own build: a global
`$` / `jQuery` must be present on any page that loads the SDK. `IMIClient.js` calls
`$.ajax` internally, but jQuery is not bundled into the SDK's build output — it is a
runtime prerequisite the host page supplies separately (for example via a
`<script src="https://code.jquery.com/jquery-1.12.4.js">` tag), exactly as it has always
worked. Do not add jQuery as an npm dependency here.

## Build

```
yarn workspace @webex/webexconnect run build:src
```

This produces `dist/webex-connect-sdk.min.js` (main SDK: `aes.js` + `IMIClient.js`) and
`dist/sw.min.js` (service worker: `mqttws31.js` + `sw/sw.js`), plus their source maps. As a
final step, `build:src` also runs `sync:sample` (`scripts/sync-sample.js`), which copies
those four artifacts into `docs/samples/webexconnect/` so the sample always runs against the
freshly-built canonical bundle.

## Sample app

`docs/samples/webexconnect/` is the demo app. It is configured for **minified** mode
(`app.config.json` → `"sourceCodeType": "minified"`) and loads `webex-connect-sdk.min.js`
directly, with the SDK registering `sw.min.js` as its service worker. Both files are the
build outputs synced from `dist/` — the sample keeps no SDK source of its own. To refresh the
sample after changing SDK source, just rebuild the package.

## Test

```
yarn workspace @webex/webexconnect run test
```

Runs ESLint (`test:style`) and the Jest smoke test (`test:unit`), which evaluates the built
bundle and asserts the `IMI` global and its core public constructors are exposed.
