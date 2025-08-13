# CC Plugin Metrics Action Plan (Consolidated)

Purpose: Single, clear list of improvements to implement for Contact Center metrics (merge prior doc + review analysis). Focus: what to add/change and where.

---

## 1. High‑Priority (Ship First)

| #   | What                               | Action                                                                                                                                                                                  | Files                                                                                                                 |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | WebCalling / media control metrics | Add success/fail + simple state events: answer, end, mute/unmute, hold/resume, remote media start, disconnect. Emit via `metricsManager.trackEvent` with correlation (taskId / callId). | `WebCallingService` (create new METRIC_EVENT_NAMES if missing; update `metrics/constants.ts`, `behavioral-events.ts`) |
| 2   | Connection lifecycle               | Emit: `SOCKET_CONNECTION_LOST`, `SOCKET_RECONNECTED`, `SILENT_RELOGIN_SUCCESS`, `SILENT_RELOGIN_FAILED`. Include agentId, orgId, lastState, reason.                                     | `services/core/websocket/*` (where connection lost handled), `cc.ts` (silentRelogin)                                  |
| 3   | Relogin & mercury connect metrics  | Track mercury connect success/fail and silent relogin outcome; add timing (use `timeEvent`).                                                                                            | `cc.ts` (in `connectWebsocket`, `silentRelogin`)                                                                      |
| 4   | Pre-validation failures            | When invalid dial number (before throwing), emit `STATION_LOGIN_FAILED` with `failureReason=INVALID_DIAL_NUMBER`, `stage=pre_validation`.                                               | `cc.ts` (stationLogin)                                                                                                |
| 5   | Flush support & reliable send      | Add `flush()` (public) + call before deregister + window `beforeunload`. Ensure pending queues submitted.                                                                               | `metrics/MetricsManager.ts`, `cc.ts` (call on `deregister`)                                                           |
| 6   | Queue overflow guard               | Cap queues (e.g. 200 each). Drop oldest with warning.                                                                                                                                   | `metrics/MetricsManager.ts`                                                                                           |
| 7   | Error handling submit              | Wrap each `submit*Event` in try/catch, log error, optionally requeue once (simple boolean retry flag).                                                                                  | `metrics/MetricsManager.ts`                                                                                           |
| 8   | Taxonomy guard                     | In `trackBehavioralEvent`, if no taxonomy, log error & return. Enforce exhaustive map typing.                                                                                           | `metrics/MetricsManager.ts`, `metrics/behavioral-events.ts`                                                           |
| 9   | Latency metrics                    | Measure: offer→accept, accept→established, established→wrapup start, wrapup duration. Add timing keys + emit on success/fail.                                                           | `services/task/TaskManager.ts`, `services/task/index.ts` (Task class)                                                 |
| 10  | Device change clarity              | Add `AUTOMATED` vs `USER_INITIATED` flag (device updates, silent relogin, auto state restore).                                                                                          | `cc.ts`, `silentRelogin()`                                                                                            |

---

## 2. Medium Priority

| #   | What                        | Action                                                                                                                                 | Files                                                  |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 11  | Metadata enrichment         | Add helper to append: sdkVersion, pluginVersion, platform, userAgent (browser), timezoneOffsetMinutes, sessionId (uuid once per page). | New `metrics/metadata.ts` (or inside `MetricsManager`) |
| 12  | Payload array handling      | Replace blanket array skip: include length (`roles_count`) or CSV for small primitive arrays.                                          | `metrics/MetricsManager.ts` (`preparePayload`)         |
| 13  | AQM payload builder         | Utility to merge common fields + custom additions consistently.                                                                        | New `metrics/metadata.ts` (`buildAQMPayload`)          |
| 14  | Normalize failures          | Standard keys: `failureType`, `failureReason`, `reasonCode`, `errorCode`, `httpStatus`, `stage`. Map existing fields.                  | Emission sites in `cc.ts`, task services               |
| 15  | Outdial PII minimization    | Hash destination (e.g. SHA-256 first 8 chars) -> `destinationHash`; remove raw destination unless mandated.                            | `cc.ts` (startOutdial)                                 |
| 16  | Duplicate suppression       | 1s in-memory cache of event name + JSON payload hash to drop bursts.                                                                   | `metrics/MetricsManager.ts`                            |
| 17  | Business metadata expansion | Add `productVersion`, `region`, `tenantType` if discoverable.                                                                          | `submitPendingBusinessEvents()`                        |

---

## 3. Low Priority / Optional

| #   | What                 | Action                                                                         | Files                                          |
| --- | -------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| 18  | Verb consistency     | Audit verbs (`set`, `complete`, `fail`) in taxonomy; align naming conventions. | `metrics/behavioral-events.ts`                 |
| 19  | Rename internal flag | `readyToSubmitEvents` → `isReady`.                                             | `metrics/MetricsManager.ts`                    |
| 20  | Selective disable    | Allow per-type disable via config flags (behavioral/operational/business).     | `metrics/MetricsManager.ts`, plugin config     |
| 21  | Deeper media stats   | On call end: jitter avg, pktLoss %, duration, mute/hold toggle counts.         | `WebCallingService` (collect) + event emission |

---

## 4. Supporting Changes (Implementation Details)

### 4.1 MetricsManager Enhancements

Add:

```ts
public flush(): Promise<void>
private augmentPayload(base: EventPayload): EventPayload
private enforceQueueLimits()
private submitWithCatch(type, fn)
```

Modify:

- `preparePayload`: support arrays (length or CSV), append `tabHidden`.
- `trackBehavioralEvent`: taxonomy guard.
- Add queue caps + overflow logging.
- Wrap each submission loop in try/catch (`submitPendingBehavioralEvents` etc.).
- Call `flush()` inside `deregister()` before teardown.

### 4.2 Timing Additions

Usage:

```ts
metricsManager.timeEvent(['TASK_OFFER_ACCEPT_SUCCESS','TASK_OFFER_ACCEPT_FAILED']);
```

On accept success/fail -> emit with duration. Similarly for accept→established, wrapup.

### 4.3 Metadata Helper (new file `metadata.ts`)

```ts
export function augment(base: EventPayload, ctx: {webex: WebexSDK}): EventPayload;
export function buildAQMPayload(base: EventPayload, resp: any): EventPayload;
```

### 4.4 New / Extended METRIC_EVENT_NAMES (add if not present)

```
CALL_ANSWER_SUCCESS / FAILED
CALL_END
CALL_MUTE_TOGGLE
CALL_HOLD_TOGGLE
CALL_REMOTE_MEDIA_START
CALL_DISCONNECT
SOCKET_CONNECTION_LOST
SOCKET_RECONNECTED
SILENT_RELOGIN_SUCCESS / FAILED
TASK_OFFER_ACCEPT_SUCCESS / FAILED
TASK_ACCEPT_TO_ESTABLISHED_SUCCESS / FAILED
WRAPUP_COMPLETE
```

Ensure taxonomy entries (behavioral) + use operational/business where applicable.

---

## 5. Test Plan (Minimal Set)

| Feature                | Test                                   |
| ---------------------- | -------------------------------------- |
| Taxonomy guard         | Unknown name logs error & no submit    |
| Queue limit            | Overflow drops oldest, warns           |
| flush()                | Forces submission when `isReady=true`  |
| Timing                 | Duration present on success/fail event |
| Metadata               | sdkVersion / platform appended         |
| Array handling         | roles array serialized correctly       |
| Duplicate suppression  | Rapid identical events → 1 submit      |
| Silent relogin metrics | Success & failure both emit            |

---

## 6. Implementation Order (Sprint Friendly)

1. New event names + taxonomy guard (1 PR)
2. Connection + relogin + mercury + pre-validation metrics (1 PR)
3. WebCalling metrics (1 PR)
4. Timing + latency metrics (1 PR)
5. Flush + queue limits + submit error handling (1 PR)
6. Metadata enrichment + array strategy (1 PR)
7. Failure normalization + hashing outdial destination (1 PR)
8. Duplicate suppression + selective disable (optional PR)
9. Media stats & low-priority refactors (optional PR)

---

## 7. Acceptance Checklist (Copy into Epic)

- [ ] All new METRIC_EVENT_NAMES defined in constants & taxonomy
- [ ] No missing taxonomy lookups (type-safe map)
- [ ] WebCalling control events emit metrics
- [ ] Connection / relogin lifecycle metrics present
- [ ] Latency metrics (offer→accept, accept→established, wrapup) captured with duration_ms
- [ ] flush() works and called on deregister & beforeunload
- [ ] Queue overflow guarded
- [ ] Submission errors logged (no uncaught promise rejections)
- [ ] Payload enriched (version, platform, sessionId)
- [ ] Arrays handled per strategy
- [ ] Failure payload normalized
- [ ] Outdial destination hashed
- [ ] Duplicate suppression (if enabled)
- [ ] Tests passing for core behaviors

---

## 8. Notes / Open Decisions

| Topic                | Option                       | Default    |
| -------------------- | ---------------------------- | ---------- |
| Array handling       | length + CSV for primitives  | length+CSV |
| Outdial hashing      | SHA-256 → first 8 chars      | Yes        |
| Duplicate window     | 1000 ms                      | 1000 ms    |
| Non-prod suppression | Keep sending but add env tag | Tag only   |
| Media stats          | Phase 2 if APIs available    | Defer      |

---

## 9. Summary

Current lifecycle coverage is solid. This plan fills observability gaps (media, reconnection, task phases), adds reliability (flush, limits, error handling), enriches analytical context, and standardizes taxonomy & failures with minimal invasive changes.

Implement top 10 high-priority items first to unlock most analytic value.
