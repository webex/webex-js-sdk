# Client Implementation Architecture: Using DSS for Phone Lookups

This document explains how a client application that consumes the Webex JS SDK can use the internal Directory Search Service (DSS) plugin to resolve contact details from a phone number. It includes recommended wiring, examples, error handling, privacy considerations, and options to future-proof the integration.

## Important note about internal plugins
`@webex/internal-plugin-dss` is an internal plugin. It is usable from apps that consume this SDK, but its API and behavior may change without semver guarantees. Use in production only if your app can tolerate potential non-backward compatible changes.

## 1. High-level approach
- Ensure the SDK is authorized with a valid access token or OAuth flow.
- Register the device (optional — SDK will register lazily) so `webex.internal.device.url` and `orgId` are available.
- Register the DSS plugin (connects Mercury) to receive asynchronous results.
- Perform searches by passing normalized phone digits as `queryString` to `webex.internal.dss.search()`.
- Interpret aggregated results and map to your app model.

## 2. Import & bootstrap
Import the plugin before creating the Webex instance so it registers with the core if you prefer explicit wiring (optional for some bundling setups):

```js
import '@webex/internal-plugin-dss';
import WebexCore from '@webex/webex-core';

const webex = new WebexCore({
  credentials: { access_token: process.env.WEBEX_TOKEN },
});
```

If you use an OAuth flow, construct `WebexCore` without a token and call `webex.authorization.requestAccessToken()` as usual.

## 3. Device & DSS registration

Registering the device explicitly can be useful to surface errors early and ensure `cisco-device-url` is ready. This step is optional — many flows will lazily register when needed.

```js
await webex.internal.device.register(); // optional
await webex.internal.dss.register();    // connects Mercury and listens for events
```

Call `webex.internal.dss.unregister()` when your app no longer needs the service.

## 4. Phone normalization helper (recommended)
Minimal normalization reduces false negatives. Keep this helper simple to avoid bundle bloat.

```js
export function normalizePhone(raw) {
  if (!raw) throw new Error('empty phone');
  const cleaned = raw.trim().replace(/[\s().-]/g, '');
  // Keep leading + if present. Do not try heavy international parsing here.
  return cleaned;
}
```

Masking helper for logs:

```js
export function maskPhoneForLog(phone) {
  if (!phone) return phone;
  const last4 = phone.slice(-4);
  return `****${last4}`;
}
```

## 5. Performing the lookup

Use `search()` passing the normalized phone digits. Narrow `requestedTypes` where possible (e.g. `['PERSON']`) and keep `resultSize` small to limit payload.

```js
async function lookupByPhone(webex, rawPhone) {
  const phone = normalizePhone(rawPhone);
  try {
    const results = await webex.internal.dss.search({
      requestedTypes: ['PERSON'],
      queryString: phone,
      resultSize: 5,
    });

    return results; // array of directory entities
  } catch (err) {
    // handle DssTimeoutError vs network/auth errors
    throw err;
  }
}
```

If you later add `queryTypes` support (when backend supports it) pass `queryTypes: ['PHONE']` in options.

## 6. Handling results

- Choose first match or apply your own ranking (match confidence, providers, presence of phone field).
- Watch for duplicates across providers — use `id` or other stable attributes to deduplicate.

## 7. Error handling

- `DssTimeoutError` — backend did not finish streaming; consider retrying with longer timeout or inform user.
- `401/403` — token scope or org mismatch; verify token scopes and `orgId`.
- Network errors — retry according to your backoff policy.

## 8. Security & privacy best practices

- Mask phone numbers in logs (only last 3–4 digits shown).
- Avoid storing PII longer than necessary; if you must cache results, use an encrypted store and TTL.
- Consider consent/legal restrictions for doing directory lookups across organizations.

## 9. Telemetry & metrics

- Emit metrics for lookup attempts and hits/misses. Correlate with `trackingid` and `requestId` from the plugin for debugging.

## 10. Cleanup

When your app shuts down or no longer needs to listen for directory changes:

```js
await webex.internal.dss.unregister();
```

## 11. When to ask for backend changes

If you need stronger phone matching or dedicated phone lookup paths, ask backend teams for:
- `/lookup/orgid/{orgId}/phones` endpoint (batched `lookupValues`) that emits `event:directory.lookup`.
- Optional `queryTypes` support on search endpoints.

## 12. Example end-to-end

```js
import '@webex/internal-plugin-dss';
import WebexCore from '@webex/webex-core';

async function run(phone) {
  const webex = new WebexCore({credentials: {access_token: process.env.WEBEX_TOKEN}});
  await webex.internal.dss.register();
  const results = await lookupByPhone(webex, phone);
  await webex.internal.dss.unregister();
  return results;
}
```

## 13. Caveats

- This uses an internal plugin — expect API churn.
- For heavy usage (large-scale batching, millions of lookups), coordinate with backend for rate limiting, batching endpoints, and caching strategies.

---

If you want, I can also add a small test harness under `packages/...` that demonstrates lookup flow using a mock Mercury emitter (unit test) or ephemeral integration script. Which would you prefer next? 
