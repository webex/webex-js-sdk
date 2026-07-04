# Contracts Catalog — @webex/calling

> Start with [AGENTS.md](../AGENTS.md), [SPEC_INDEX.md](SPEC_INDEX.md), and [ARCHITECTURE.md](ARCHITECTURE.md). `src/index.ts` is the authoritative consumer-facing boundary.

### API Endpoints

This package does not expose an inbound HTTP API. It consumes Webex HTTP APIs; those dependencies are listed under **Requires** and detailed in owning module specs.

### Exported API & Types

| Contract ID | Owner | Symbol | Signature/surface | Stability | Detail | Defined at |
|---|---|---|---|---|---|---|
| calling.client.create | CallingClient | `createClient` | creates `ICallingClient` from Webex SDK/config | semver public | CallingClient spec | `src/index.ts` |
| calling.history.create | CallHistory | `createCallHistoryClient` | creates `ICallHistory` | semver public | CallHistory spec | `src/index.ts` |
| calling.recording.create | CallRecording | `createCallRecordingClient` | creates `ICallRecording` | semver public | CallRecording spec | `src/index.ts` |
| calling.settings.create | CallSettings | `createCallSettingsClient` | creates `ICallSettings` | semver public | CallSettings spec | `src/index.ts` |
| calling.contacts.create | Contacts | `createContactsClient` | creates `IContacts` | semver public | Contacts spec | `src/index.ts` |
| calling.voicemail.create | Voicemail | `createVoicemailClient` | creates `IVoicemail` | semver public | Voicemail spec | `src/index.ts` |
| calling.logger | Logger | `Logger`, `LOGGER` | SDK logging configuration/types | semver public | `RULES.md` | `src/index.ts` |
| calling.media | media-helpers | `createMicrophoneStream`, `NoiseReductionEffect`, `LocalMicrophoneStream` | media helper re-exports | upstream + package semver | TypeScript declarations | `src/index.ts` |
| calling.types | package | interfaces, setting/contact/recording/call/event/common types | TypeScript consumer contracts | semver public | TypeScript declarations | `src/index.ts` |
| calling.backend.resolve | common | `resolveCallingBackend` | resolves calling backend from SDK state | semver public | architecture | `src/index.ts` |

### Events

| Contract ID | Owner | Event family | Direction | Payload detail | Delivery | Compatibility | Defined at |
|---|---|---|---|---|---|---|---|
| calling.client.events | CallingClient | `CALLING_CLIENT_EVENT_KEYS` | publish to consumer | typed event maps | in-process async callbacks | additive keys/payload fields preferred | `src/Events/types.ts` |
| calling.line.events | Line | `LINE_EVENT_KEYS`, `LINE_EVENTS` | publish to consumer | typed event maps | in-process callbacks | semver public | `src/Events/types.ts` |
| calling.call.events | Calling | `CALL_EVENT_KEYS`, `COMMON_EVENT_KEYS` | publish to consumer | typed event maps | event-driven; ordering follows call state | semver public | `src/Events/types.ts` |
| calling.recording.events | CallRecording | recording Mercury event family | consume then publish | recording types | upstream Mercury delivery; local typed emission | additive payload handling | `src/Events/types.ts` |
| calling.history.events | CallHistory | call-session Mercury events | consume then publish | `UserSession`/history event types | upstream Mercury delivery | additive handling | `src/Events/types.ts` |
| calling.mobius.events | Mobius socket | Mobius async messages | consumed internally | Mobius socket types | deduplicated internal stream | internal contract | `src/mobius-socket/types.ts` |

### Commands & Flags

No CLI is exposed. Runtime feature/config inputs include `CallingClientConfig`, logger level, service indicator, production/test API selection, and the restricted sample-page Mobius WebSocket local override.

## Requires — what this repo depends on

| Dependency | Consumed contract | Detail | Availability assumption | Failure behavior | Version floor |
|---|---|---|---|---|---|
| Webex SDK/device/feature/metrics plugins | identity, device, feature flags, requests, telemetry | `package.json` | initialized SDK and valid token | typed/logged errors; caller event/result by module | workspace versions |
| Webex calling services | discovery, registration, calls, settings, history, recording, contacts, voicemail | module specs | network availability and authorized user | module-specific retry, fallback, error response, or event | service contract |
| Mobius WebSocket | signaling requests and async events | Mobius socket spec | authorized URL/token | backoff, refresh, close-code handling, fallback path where configured | protocol implemented in source |
| Mercury | history/recording/calling events | module specs | SDK event transport active | missed/late events handled by module state and cleanup rules | SDK-provided |
| `@webex/media-helpers` and internal media core | streams/media connection | Calling spec | compatible package versions/browser media | call/media errors and cleanup | `package.json` |
| XState, async-mutex, backoff, ws | state machines, serialization, mutual exclusion, retry, transport | `package.json` | declared package versions | internal failures surface through owning modules | pinned/ranged in `package.json` |

## Compatibility & Deprecation Policy

- Breaking exports, signatures, event payloads, or observable behavior require semver review, consumer transition notes, tests, and a changelog entry.
- Deprecations must remain available for the documented transition window and be marked in TypeScript/JSDoc and this catalog before removal.

## Detailed Interface Docs

- Exact SDK signatures and payload types remain in `src/index.ts`, `src/api.ts`, module `types.ts`, and generated TypeDoc output.
- Behavioral contracts, failures, flow, and backend differences live in the module specs routed by `SPEC_INDEX.md`.

## Maintenance

- Update this catalog, the owning module spec, `.sdd/manifest.json`, source declarations, tests, and changelog together for public changes.
- `GLOSSARY.md` defines terms. No root `DATA_MODEL.md` is generated because the package owns no datastore.
