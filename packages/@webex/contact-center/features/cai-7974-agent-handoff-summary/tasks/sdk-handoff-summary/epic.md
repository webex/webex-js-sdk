# Epic - SDK handoff summary API and event routing

## Metadata
| Field | Value |
|---|---|
| Epic title | SDK handoff summary API and event routing |
| Parent feature | `../../design/feature-design.md` and `../../spec/feature-spec.md` |
| Service group / capability | `@webex/contact-center` task and AI Assistant SDK surface |
| Tracker / Epic key | `CAI-7974` |
| Status | ready |
| created_by / approved_by / date | Codex generator / user chat approval / 2026-06-30 |
| Generated from | `epic` @ SDLC template library `0.2.0` |

## Scope - the slice of the design this epic delivers
This epic delivers the package-local SDK capability for handoff summary request, response, and event delivery. It owns public task helpers/events/types, AI Assistant `/event` payload support, websocket routing, tests, and SDD spec currency for `packages/@webex/contact-center`.

## Mapped Design Sections
| Feature design section | What this epic delivers from it |
|---|---|
| Functional-Block Decomposition | Task helper block, AI Assistant transport extension, websocket handoff router |
| Interface & Contract Definitions | Task API contract and AI Assistant event contract |
| Protocol / Wire-Format Design | Event names and pass-through payload handling |
| Sequence Diagrams | Request/receive/respond/enablement flows |
| Test Strategy | Unit coverage for helpers, websocket routing, and transport shape |

## Summary of Changes
- **`src/services/task/`:** add task helper methods, public types/events, websocket summary routing, unit tests, and module spec updates.
- **`src/services/ApiAiAssistant.ts`:** allow optional action and additional event detail data in `sendEvent`.
- **`src/types.ts`:** add shared AI Assistant event action type.
- **`src/services/config/types.ts`:** add backend handoff summary event names.
- **`ai-docs/`:** update contracts, service state, glossary, architecture, and module specs.

## Baseline vs This Epic
| Capability | Already shipped (baseline) | Added by this epic |
|---|---|---|
| AI Assistant `/event` transport | transcript start/stop events | handoff summary request/response events |
| Generated summaries config | `consultTransferSummariesEnabled` typed in config | task helper gate and optional runtime enablement handling |
| Task websocket routing | task lifecycle and transcript events | handoff summary delivery and subsequent-agent response events |

## Child Tasks
| Task | One-line | PR-sized? | Task doc | Tracker key |
|---|---|---|---|---|
| T1 | Implement SDK handoff summary helpers, event routing, tests, and docs | yes | `task-1.md` | `CAI-7974` |

## Sequencing & Dependencies
| Task / epic | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T1 | feature spec/design soft-commit | N/A - only task | wave 1 |

## Rollout Order
1. Ship SDK code and docs with additive APIs.
2. Backend enables generated summaries for selected agents/tenants.
3. Widget consumes new task helpers/events.

## Exit Criteria
- [ ] Public helper methods and task events are implemented.
- [ ] Unit tests pass for task helper, TaskManager routing, and ApiAIAssistant event payloads.
- [ ] SDD/docs and contract catalog are updated in the same merge.

## References
- Feature design: `../../design/feature-design.md`
- Feature spec: `../../spec/feature-spec.md`
- Child task: `./task-1.md`
