# Glossary — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Domain Terms

| Term | Definition (one or two sentences) | Authoritative location (file/type) | Notes / synonyms to avoid |
|---|---|---|---|
| ContactCenter | Host-embedded Webex plugin exposing the package API. | `src/cc.ts` | Registered as `cc`. |
| Agent Profile | Aggregated remote configuration used during an agent session. | `src/services/config/types.ts` | Do not call it durable local state. |
| Task | Client representation of a contact-center interaction and its operations. | `src/services/task/Task.ts` | Backed by remote interaction data. |
| AQM request | HTTP initiation whose success/failure may be delivered by correlated WebSocket notification. | `src/services/core/aqm-reqs.ts` | Not request-over-WebSocket. |
| TaskEvent | Typed internal state-machine event mapped from API calls or backend events. | `src/services/task/state-machine/constants.ts` | Distinct from raw CC_EVENTS. |
| PageCache | Five-minute in-memory cache for simple paginated data-service requests. | `src/utils/PageCache.ts` | Parameterized searches bypass it. |

## Abbreviations & Acronyms

| Abbreviation | Expansion | Meaning in this repo |
|---|---|---|
| WCC | Webex Contact Center | Remote Contact Center service family. |
| AQM | Agent Queue Manager | Backend operation/correlation pattern. |
| RTD | Realtime data/transcription | Secondary realtime WebSocket stream. |
| RONA | Ring On No Answer | Offered-task failure state/event. |
| ANI | Automatic Number Identification | Outbound caller-id selection data. |

## Context-Specific Meanings

| Term | Context / module | Meaning here |
|---|---|---|
| Event | Config/Core | Raw backend WebSocket event. |
| Event | Task state machine | Typed TaskEvent after mapping. |
| State | Agent | Backend agent availability/substatus. |
| State | Task | XState task lifecycle state. |

## Deprecated / Renamed Terms

| Old term | Current term | Why renamed | Still appears in |
|---|---|---|---|
| plugin-cc | contact-center | Package rename recorded in history. | Older history and integrations. |

## Maintenance

- Add new entities, events, states, or renamed concepts here in the same change.
