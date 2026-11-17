# Task — T1: V2 Types, Request Builders & Events

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Start here → repo [`AGENTS.md`](../../../../AGENTS.md). Under [`epic.md`](./epic.md) ↔ plan [`implementation-plan-t1.md`](./implementation-plan-t1.md); implements [`../../design/feature-design.md`](../../design/feature-design.md).

## Metadata
| Field | Value |
|---|---|
| Task title | V2 types, request builders & events |
| Parent epic | [`./epic.md`](./epic.md) |
| Task type | backend |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`services/agent`, `services/config`) |
| Tracker key | WXCC-15791 |
| State | merged |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Feature Design → Functional-Block Decomposition (request builders) + Object-Model Changes + Interface & Contract Definitions.

## Primary Code Touchpoints
- `src/services/agent/types.ts` — add `SessionVersion`, `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`, `AgentStateControlStatus`, `ChannelStateChangeRequest`; add V2 `AGENT_EVENTS`.
- `src/services/agent/index.ts` — add `stationLoginV2`, `stateChangeV2`, `logoutV2` builders; centralize V2 endpoint paths. (`reloadV2` was dropped; the unified `reload()` branches on server-chosen response type.)
- `src/services/config/types.ts` / `Util.ts` — V2 `CC_EVENTS`/`CC_AGENT_EVENTS`; `manageChannelAvailability` on `AgentProfile` + `parseAgentConfigs()` mapping.
- `src/index.ts` — export the new types.
- `src/types.ts` — V2-related types (no host override config; `manageChannelAvailability` is the sole V2 signal).

## Ownership Boundary
- Owns: `services/agent/types.ts`, `services/agent/index.ts`, `services/config/types.ts`, `services/config/Util.ts`, `src/index.ts`, `src/types.ts`.
- Must NOT touch: `services/agent/aggregate.ts`, `cc.ts` V2 logic → owned by T2.

## Multi-Repo Scope
| Target repo | Module | Why | Manifest / standing docs |
|---|---|---|---|
| `webex/webex-js-sdk` | `@webex/contact-center` | N/A — single target repo | `ai-docs/` |

## Dependencies / Execution Stream
| This task | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T1 | — | — | 1 |

## Acceptance Criteria
- [ ] V2 types exported from `src/index.ts`.
- [ ] V2 request builders available on `routingAgent`.
- [ ] `manageChannelAvailability` parsed into `Profile`; V2 event constants present.

## Verifier Exit Criteria
- [ ] Build clean; no change to V1 exports.
- [ ] Endpoint paths centralized in `services/agent/index.ts`.

## Traceability
| Requirement | Code symbol | Test |
|---|---|---|
| R-10 | `parseAgentConfigs()` | `cc.ts` eligibility tests |
| Contracts | `stateChangeV2`/`stationLoginV2`/`logoutV2` | `cc.ts` routing tests |

## Coverage Expectation
- Covered by T3 within the package 85% gate.

## Non-Goals

- Implementing V2 orchestration logic in `cc.ts` (owned by T2).
- Adding the V2→V1 event bridge or `aggregate.ts` (owned by T2).
- Writing unit tests or sample-app changes (owned by T3).
- Runtime feature-flag infrastructure in the SDK; enablement is profile-driven.
- Modifying existing V1 type definitions or request builder signatures.

## Cross-Cutting Prompts

- **Observability**: Are logs/metrics emitted for this task's state transitions?
- **Error handling**: Are failures surfaced to the consumer (event/callback/UI)?
- **Backward compatibility**: Does this change break existing V1 consumers?
- **Security**: Does this task handle any PII or authentication tokens?
