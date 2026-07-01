# Test Strategy - Agent Handoff Summary events and public APIs

## Metadata
| Field | Value |
|---|---|
| Feature / ticket key | `cai-7974-agent-handoff-summary` / `CAI-7974` |
| Feature Spec | `spec/feature-spec.md` |
| Feature Design | `design/feature-design.md` |
| Generated from | `test-strategy` @ SDLC template library `0.2.0` |

## References
- Feature Spec: `spec/feature-spec.md`
- Repo architecture: `../../ai-docs/ARCHITECTURE.md`

## Test Config Variables
| Variable | Possible values |
|---|---|
| `apiAIAssistant.aiFeature.generatedSummaries.consultTransferSummariesEnabled` | `true`, `false`, `undefined` |
| websocket message type | `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, `FEATURE_ENABLEMENT`, existing transcript events |
| handoff response action | `CANCEL`, `CONSULT`, `TRANSFER` |

## Use Cases -> Tests
| # | Use case / acceptance criterion | Positive case | Negative case | Status |
|---|---|---|---|---|
| 1 | Request handoff summary sends AI Assistant event | enabled flag sends `GET_MID_CALL_SUMMARY` | disabled flag rejects and sends nothing | planned |
| 2 | Respond to handoff summary sends typed action | `TRANSFER` action sends `MID_CALL_SUMMARY_RESPONSE` | missing/invalid action fails type or runtime guard | planned |
| 3 | Summary websocket routes to task | `MID_CALL_SUMMARY` emits `task:handoffSummary` | unknown task id does not emit on any task | planned |
| 4 | Subsequent-agent response routes to task | `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` emits `task:handoffSummaryResponse` | unrelated event does not emit response event | planned |
| 5 | Feature enablement updates flag | boolean enablement updates `aiFeature.generatedSummaries.consultTransferSummariesEnabled` | malformed payload is ignored without throwing | planned |
| 6 | Existing transcript routing is preserved | existing transcript start/stop tests still pass | disabled realtime transcript flag suppresses transcript sends | existing + planned regression |

## Contract Tests
| Scenario / interface | Consumer | Producer | CI stage |
|---|---|---|---|
| Task handoff helper signatures and event enum | SDK consumer typings | `src/services/task/types.ts` | package unit/build |
| AI Assistant `/event` body | WCC AI Assistant service | `src/services/ApiAiAssistant.ts` | package unit |

## Integration Tests
| Scenario | Suite | Automated | In CI |
|---|---|---|---|
| Websocket event to task event routing | `test/unit/spec/services/task/TaskManager.ts` with EventEmitter websocket mock | yes | package unit |
| Task helper to AI Assistant transport | `test/unit/spec/services/task/index.ts` with mocked ApiAIAssistant | yes | package unit |

## Resiliency Tests
| Failure injected | Expected behavior | Suite | In CI |
|---|---|---|---|
| Disabled generated summary flag | helper rejects before network call | unit | yes |
| AI Assistant request rejection | helper propagates detailed task error path | unit | yes |
| Malformed enablement payload | TaskManager ignores without throwing | unit | yes |

## QA Dependencies
| Dependency | Needed for | Ready? |
|---|---|---|
| Backend payload schema for summary events | contract hardening beyond generic payload pass-through | not in this repo |
| Tenant/agent with generated summaries enabled | manual or integration validation outside package unit tests | pending backend/product |

## E2E Framework & Location
- Framework: Jest 27 via `@webex/jest-config-legacy`
- Test directory: `packages/@webex/contact-center/test/unit/spec/`
- Target invocation: `yarn workspace @webex/contact-center test:unit --targets services/task/index.ts` and related target files
- Runs in CI: package unit test stage

## Coverage Summary
| Test type | Scenarios | Automated | In CI | Status |
|---|---|---|---|---|
| Unit | 6 | yes | yes | planned |
| Contract/typing | 2 | yes via TypeScript/build/unit import coverage | yes | planned |
| Integration | 2 with mocked websocket/request layers | yes | yes | planned |
| E2E/manual | backend-enabled tenant smoke | no | no | dependency pending |

## Gaps / Risks
| Gap | Impact | Mitigation |
|---|---|---|
| No backend machine-readable schema in repo | SDK cannot validate summary body fields | generic payload pass-through; document schema follow-up with backend owners |
| No live backend test in this repo | Unit tests cannot prove tenant rollout behavior | manual QA dependency before GA |
