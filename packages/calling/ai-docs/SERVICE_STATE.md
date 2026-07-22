# Service State (living) — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · contracts [`CONTRACTS.md`](CONTRACTS.md). This records current SDK surfaces and dependencies, not planned behavior.

## Current Events

| Event family | Direction | Producer/consumer | Payload ref |
|---|---|---|---|
| `call-history` typed event family | publish/consume | `src/CallHistory/` | `src/Events/types.ts` and owning spec |
| `call-recording` typed event family | publish/consume | `src/CallRecording/` | `src/Events/types.ts` and owning spec |
| `calling-client` typed event family | publish/consume | `src/CallingClient/` | `src/Events/types.ts` and owning spec |
| `calling` typed event family | publish/consume | `src/CallingClient/calling/` | `src/Events/types.ts` and owning spec |
| `line` typed event family | publish/consume | `src/CallingClient/line/` | `src/Events/types.ts` and owning spec |
| `mobius-socket` typed event family | publish/consume | `src/mobius-socket/` | `src/Events/types.ts` and owning spec |

## External Dependencies

| Dependency | Used for | Timeout / retry | Circuit breaker / fallback |
|---|---|---|---|
| Webex request client and Janus call-history APIs | Required by `src/CallHistory/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Mercury real-time events | Required by `src/CallHistory/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| UCM Lines API for line enrichment | Required by `src/CallHistory/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex hydraDeveloperApi recording endpoints | Required by `src/CallRecording/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Mercury recording lifecycle events | Required by `src/CallRecording/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Calling-backend resolution | Required by `src/CallRecording/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex Calling XSI/Hydra services | Required by `src/CallSettings/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| UCM management gateway | Required by `src/CallSettings/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Calling-backend resolution | Required by `src/CallSettings/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| SDKConnector and Webex device/feature/service plugins | Required by `src/CallingClient/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Calling, Line, Registration, Metrics, and mobius-socket modules | Required by `src/CallingClient/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| WebRTC media helpers | Required by `src/CallingClient/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Mobius signaling through APIRequest | Required by `src/CallingClient/calling/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| @webex/internal-media-core ROAP/media engine | Required by `src/CallingClient/calling/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| CallerId, Metrics, Logger, and SDKConnector | Required by `src/CallingClient/calling/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Mobius SIP-style identity headers | Required by `src/CallingClient/calling/CallerId/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| SCIM people lookup through the Webex SDK | Required by `src/CallingClient/calling/CallerId/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Registration and Calling submodules | Required by `src/CallingClient/line/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| SDKConnector event bridge | Required by `src/CallingClient/line/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Mobius registration APIs through APIRequest | Required by `src/CallingClient/registration/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Web Worker keepalive timer | Required by `src/CallingClient/registration/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex bounded storage and metrics | Required by `src/CallingClient/registration/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex contacts service | Required by `src/Contacts/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex KMS encryption | Required by `src/Contacts/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| SCIM people lookup | Required by `src/Contacts/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| @webex/internal-plugin-metrics through Webex SDK | Required by `src/Metrics/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Calling error/event types | Required by `src/Metrics/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Initialized and authorized WebexSDK instance with Mercury | Required by `src/SDKConnector/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex Calling, BroadWorks, and UCM voicemail services | Required by `src/Voicemail/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Contacts resolution and Metrics | Required by `src/Voicemail/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| WebSocket implementation | Required by `src/mobius-socket/` | Owning module retry/error policy | Owning module fallback/backend strategy |
| Webex credentials, device feature settings, and Mobius discovery | Required by `src/mobius-socket/` | Owning module retry/error policy | Owning module fallback/backend strategy |

## Key Metrics & Performance Targets

| Signal | Current target/posture | Where measured |
|---|---|---|
| Registration/call/media/connection/voicemail errors | Submit typed operational/behavioral metrics on success and failure paths | `src/Metrics/` |
| Mobius connection/reconnect | Preserve bounded backoff, auth refresh, and cleanup behavior | `src/mobius-socket/` |
| Call keepalive/registration keepalive | Preserve configured intervals/retry limits | `src/CallingClient/` |

## Feature Flags (current)

| Flag | Gates | Current default | Owner | Safe to remove when |
|---|---|---|---|---|
| `webrtc-calling-over-ws-CALL-219562` | Mobius WebSocket transport path | WDM/host configuration | CallingClient + mobius-socket | HTTP/WSS transition is formally completed and compatibility plan approved |

## Maintenance

- Update events, dependencies, metrics, and flags here in the same change that alters their implementation or contract.
