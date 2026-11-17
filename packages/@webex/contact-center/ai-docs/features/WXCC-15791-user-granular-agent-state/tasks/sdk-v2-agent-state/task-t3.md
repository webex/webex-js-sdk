# Task — T3: Unit Tests & Sample-App Panel

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Start here → repo [`AGENTS.md`](../../../../AGENTS.md). Under [`epic.md`](./epic.md) ↔ plan [`implementation-plan-t3.md`](./implementation-plan-t3.md); implements [`../../design/feature-design.md`](../../design/feature-design.md).

## Metadata
| Field | Value |
|---|---|
| Task title | Unit tests & sample-app panel |
| Parent epic | [`./epic.md`](./epic.md) |
| Task type | validation |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`test/unit`, `docs/samples`) |
| Tracker key | WXCC-15791 |
| State | merged |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Feature Design → Test Strategy; Spec R-14 (sample panel).

## Primary Code Touchpoints
- `test/unit/spec/services/agent/aggregate.ts` — projection + suppression (24 tests).
- `test/unit/spec/cc.ts` — V2 routing, pinning, fallback, recovery, getters, events (156 tests).
- `docs/samples/contact-center/index.html` + `app.js` — "Manage channel availability" panel.

## Ownership Boundary
- Owns: `test/unit/spec/**` V2 specs, `docs/samples/contact-center/*`.
- Must NOT touch: production `cc.ts`/`aggregate.ts` → owned by T2.

## Multi-Repo Scope
| Target repo | Module | Why | Manifest / standing docs |
|---|---|---|---|
| `webex/webex-js-sdk` | `@webex/contact-center` | N/A — single target repo | `ai-docs/` |

## Dependencies / Execution Stream
| This task | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T3 | T1, T2 | — | 3 |

## Acceptance Criteria
- [ ] `aggregate.ts` and `cc.ts` V2 paths covered; obsolete per-helper specs removed.
- [ ] Sample panel exercises every V2 API and refreshes on the `stationLogin()` promise + relogin + logout.

## Verifier Exit Criteria
- [ ] `aggregate.ts` bridge tests pass. `cc.ts` covers the V2 login fallback only. Routing, getters, events, validation, and recovery are not unit-tested yet. The 85% gate was not re-measured for this change.

## Traceability
| Requirement | Code symbol | Test |
|---|---|---|
| R-8 | `aggregate.*` | `aggregate.ts` |
| R-1..R-13 | `cc.ts` V2 paths | `cc.ts` |
| R-14 | sample panel | manual / sample |

## Coverage Expectation
- Changed-line coverage within the package 85% gate; evidence: CI coverage report.

## Non-Goals

- Modifying production code in `cc.ts` or `aggregate.ts` (owned by T2).
- Adding or changing V2 types, builders, or config parsing (owned by T1).
- Achieving 100% branch coverage for every edge case; focus is on the 85% gate.
- Testing widget-layer or store-layer V2 behavior (owned by widgets repo W3).
- Automating sample-app E2E tests; sample panel validation is manual.

## Cross-Cutting Prompts

- **Observability**: Are logs/metrics emitted for this task's state transitions?
- **Error handling**: Are failures surfaced to the consumer (event/callback/UI)?
- **Backward compatibility**: Does this change break existing V1 consumers?
- **Security**: Does this task handle any PII or authentication tokens?
