# KMS context recovery validation

The change under test is on `kms-context-recovery`, targeting `next`. The implementation and unit tests are the only product changes. See [summary.json](summary.json) for the checked source commit and numerical results. The [implementation](https://github.com/webex/webex-js-sdk/blob/f5b653ca84aeaecc087db5515d2b66c33f6818fc/packages/@webex/internal-plugin-encryption/src/kms.js#L714) and [regression tests](https://github.com/webex/webex-js-sdk/blob/f5b653ca84aeaecc087db5515d2b66c33f6818fc/packages/@webex/internal-plugin-encryption/test/unit/spec/kms.js#L244) are pinned to that commit.

## Bug and acceptance criteria

A KMS context stores the result of asynchronous session-key negotiation. Previously, a rejected negotiation remained cached. Subsequent operations reused the rejection even after connectivity recovered. The fix evicts that rejected promise only when it is still the cached promise; an older failure cannot erase a replacement context.

Acceptance criteria:

- A timeout or other negotiation failure reaches the current caller, and a later call can negotiate successfully.
- Repeated failures remain retryable.
- Concurrent callers share negotiation, successful contexts remain cached, and bearer authorization refresh still works.
- A late rejection preserves a replacement context.
- Successful context expiry remains thirty seconds before key expiry.

## Unit and mutation validation

Commands use Node.js 22.14.0:

```sh
yarn workspace @webex/internal-plugin-encryption build:src
yarn workspace @webex/internal-plugin-encryption test:unit --targets kms.js
yarn workspace @webex/internal-plugin-encryption test:unit
```

All 21 focused KMS tests and all 53 tests across the four encryption-plugin suites pass. The seven added context scenarios cover every acceptance criterion above. The baseline exits with an unhandled synthetic `KmsTimeoutError`; the fixed implementation handles the bookkeeping rejection while preserving the caller's error.

Seven deliberate regressions were each detected by the focused tests: omit rejection eviction, remove or invert the replacement guard, omit success caching, omit expiry, omit bearer refresh, and return the wrong context. The guard-removal mutation fails specifically in the late-rejection/replacement scenario. Production code was restored and rebuilt, and the complete encryption-plugin unit suite was rerun afterward.

Targeted ESLint completed with no errors and five existing warnings. Prettier and Git whitespace checks pass. Normal commit hooks ran successfully.

## Real-client diagnosis and startup validation

In a standalone Chrome session, the original handshake exhausted its 8/16/32/64-second retry sequence. A normal operation then failed in approximately 1.9 ms. A fresh handshake bypassing the old cache succeeded in 308 ms and its asynchronous response was received and routed; a normal operation still failed in approximately 1.9 ms afterward. This isolates cached rejection as a persistence mechanism. It does not attribute the original unavailable response to a particular Mercury change.

A temporary startup-only Playwright diagnostic adapts the existing PWA test's initial space check. It reuses an existing test account and opens an existing space, with a healthy case plus a case that rejects exactly one negotiation with a synthetic error. The existing account does not provide the provisioned-test Welcome Space fixture; an earlier Welcome Space wait was not a valid empty-list check. It sends no messages and performs no offline or locale steps. All instrumentation ends with the disposable browser context.

With the production retry budget, the controlled failure was followed by a real negotiation timeout and then a successful fresh negotiation. Three preparations were observed; the last began around 124 seconds after instrumentation started. This establishes recovery through the real SDK and transport. That run landed on Meetings without navigating to Messaging, so its Welcome Space assertion is invalid and is not used as UI evidence.

The corrected startup check explicitly opens Messaging. Its diagnostic-only timeout configuration is `kmsInitialTimeout=1000`, `kmsMaxTimeout=4000`, and `ecdhMaxTimeout=12000` milliseconds. These shorter values exercise a different retry threshold and are not used to prove the original production retry sequence. Both final UI checks failed: the Messaging list remained empty at the wait deadline, although each run recorded one successful negotiation and another preparation still pending. The numerical summary records both outcomes. The SDK cache recovery is therefore not claimed as a complete startup fix. Production configuration is unchanged.

## Limits and privacy

This is a recovery fix. Initial asynchronous reply loss and startup latency are separate questions. Live validation is limited to Chrome on macOS; the automated unit cases cover the cache logic without requiring real-time failures.

Evidence contains synthetic values and aggregate counters only. Raw application logs, Playwright traces, account names, credentials, local filesystem paths, device IDs and session IDs are excluded.
