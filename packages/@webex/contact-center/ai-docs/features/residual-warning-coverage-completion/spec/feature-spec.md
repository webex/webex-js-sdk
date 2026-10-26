# Feature Spec — Residual Warning and Coverage Completion

> Start here → package root [`AGENTS.md`](../../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ARCHITECTURE.md). This is a documentation-only protected-spec delta; it does not authorize runtime or manifest-status changes.

## Metadata

| Field | Value |
|---|---|
| Feature / ticket key | `CC-SDD-RESIDUAL-COVERAGE-20260707` |
| Title | Residual validator warning and coverage completion |
| Status | verified — independent clean revalidation PASS; 0 Blocking, 0 warnings |
| Change class | documentation-only MODIFIED drift and coverage delta |
| created_by / approved_by / date | Codex generator / developer-approved warning cleanup and focused gap backfill / 2026-07-07 |
| Generated from | `feature-spec` @ SDLC template library `0.2.1` |

## Problem & Goal (WHAT + WHY)

**What:** Remove the ten non-blocking findings in the independent revalidation report and add the ten code-answerable security/auth, rollout, and observability applicability statements identified by coverage review.

**Why:** The independent Blocking gate is clear, but internally contradictory secondary documentation and six incomplete module profiles prevent a clean validator result and keep module coverage at 3/9.

## Stakeholders & Open Questions

| Stakeholder / role | Interest | Sign-off needed? |
|---|---|---|
| Contact Center maintainers | Canonical specs remain internally consistent and evidence-backed | yes — supplied 2026-07-07 |
| SDK consumers | No fictional APIs, paths, fields, or timeout behavior | covered by independent revalidation |
| Coverage reviewer | All mandatory applicability fields are explicit | deterministic review required |

**Open questions:** None. The developer explicitly approved all ten warning corrections and all ten coverage applicability statements, with no manifest promotion.

## Scope

**In scope:**

- Correct `IMP-S1`, `IMP-C1`, `IMP-C2`, `MED-1` through `MED-3`, and `MIN-1` through `MIN-4` from the independent revalidation report.
- Backfill the ten measured applicability gaps across Metrics, Services, Core, Task, Task state machine, and Utils.
- Refresh source-fidelity inventories, generated-document conformance, coverage measurement, module coverage metadata, and decision logs.

**Out of scope:**

- Runtime source or test changes.
- New APIs, events, fields, flags, transports, or behavior.
- `.sdd/manifest.json` status/evidence promotion or any `Partial` → `Specced` transition.
- External posting or committing local run-record and audit artifacts.

## Requirements

| Req ID | Requirement (WHAT) | Rationale (WHY) | Acceptance (how proven) | State |
|---|---|---|---|---|
| COMPLETION-R-001 | Make every secondary timeout, config, example, diagram, taxonomy, path, count, and field description agree with its authoritative section and current source. | A canonical spec is unsafe when correct primary material coexists with contradictory examples. | All ten validator warnings are absent from deterministic scans and a later independent revalidation. | Approved |
| COMPLETION-R-002 | Add each of the ten measured security/auth, rollout, and observability applicability statements with concrete source evidence. | Coverage fields scored WEAK when ownership or N/A boundaries were implicit. | All nine module specs score 15/15 mandatory fields in coverage review. | Approved |
| COMPLETION-R-003 | Preserve runtime behavior, tests, public semver, and manifest coverage states. | This pass documents current behavior; it does not change or promote it. | No non-documentation runtime/test diff and no manifest edit. | Approved |
| COMPLETION-R-004 | Preserve migration source fidelity and template/profile conformance. | Focused edits must not discard routed legacy detail or bypass the generated-document contract. | All source-fidelity inventories and the new conformance report pass. | Approved |

## Acceptance Criteria

- The three Important, three Medium, and four Minor revalidation findings have no remaining matching contradictory text.
- Metrics explicitly states host-auth inheritance and no credential ownership.
- Services explicitly states host-auth inheritance and that its composition root owns no rollout flag.
- Core explicitly distinguishes timeout/recovery constants from rollout flags and states that Core owns no feature gate.
- Task explicitly states authenticated transport is delegated through routing/Core and Task owns no credentials.
- Task state machine explicitly states its security, rollout/config, and observability ownership boundaries.
- Utils explicitly states its credential/data boundary and absence of rollout flags.
- Coverage measures 135/135 mandatory fields and 9/9 COMPLETE modules while manifest statuses remain `Partial`.
- No non-Markdown runtime file or test file changes, and `.sdd/manifest.json` remains byte-for-byte unchanged.

## Success & Guardrail Metrics

| Metric | Type | Baseline | Target / bound | How measured |
|---|---|---:|---:|---|
| Residual validator warnings | success | 10 | 0 matching residuals | deterministic scan plus later independent validator |
| COMPLETE module specs | success | 3/9 | 9/9 | coverage review |
| Mandatory field coverage | success | 125/135 | 135/135 | coverage review |
| Runtime/test changes | guardrail | 0 | 0 | scoped git status/diff |
| Manifest promotions | guardrail | 0 | 0 | manifest hash/diff |

## Prior-Work Register

| Existing artifact | Relationship | Disposition |
|---|---|---|
| Independent revalidation report | Defines the exact ten-warning scope | reuse as reviewed input |
| Coverage report | Defines the exact ten applicability gaps | supersede its measurement with a new pass; retain audit history |
| Validator drift-fix delta | Cleared the nine Blocking findings | extend through this separate approved residual delta |
| Current source and tests | Behavioral referee | read-only evidence |

## Contracts Delta

**Provides:** MODIFIED documentation only. No runtime contract is added, removed, renamed, or reclassified.

**Requires:** MODIFIED documentation only. Security/auth inheritance, rollout ownership, observability ownership, timeout ownership, and existing collaborator details are made explicit.

## Impacted Modules / Repos

| Module | Documentation impact | Runtime impact |
|---|---|---|
| Metrics | taxonomy/count consistency plus auth applicability | none |
| Services | timeout/RTD consistency plus auth and rollout applicability | none |
| Agent | qualify the Core utility path | none |
| Config | complete secondary AI-feature material and team wording | none |
| Core | real AqmReqs example, path casing, rollout applicability | none |
| Task | explicit event count and auth boundary | none |
| Task state machine | security, rollout/config, and observability boundaries | none |
| Utils | security/data and rollout boundaries | none |

## MODIFIED Requirements

### MOD-001 — Services consistency and applicability

- Correct the `WEBSOCKET_EVENT_TIMEOUT` description and show both primary and RTD WebSocket managers in the early composition diagram.
- State that authenticated requests inherit host SDK identity through Core/WebexRequest; Services stores no credentials.
- State that Services owns no rollout flag and is constructed unconditionally at READY; downstream capabilities consume their own configuration.

### MOD-002 — Config secondary-section consistency

- Add AI feature flags to the ASCII aggregation diagram, `parseAgentConfigs` example, output profile, and failure list.
- Remove the claim that teams contain channel configurations.

### MOD-003 — Core example, path, and rollout applicability

- Make the AqmReqs state-change example match the real outer/nested binds, payload wrapper, and PUT method.
- Correct the traceability label to `connection-service.ts`.
- State that timeout/reconnect constants are behavior controls, not rollout flags, and Core owns no feature gate.

### MOD-004 — Metrics taxonomy/count and auth applicability

- Reconcile every early taxonomy statement to 80 total names, 71 mapped, and 9 unmapped.
- State that MetricsManager uses the host metrics client and owns no credentials or authorization policy.

### MOD-005 — Task count and auth applicability

- State that the complete public event inventory contains 49 `TASK_EVENTS`.
- State that Task owns no credentials and delegates authenticated operations through routing/AqmReqs/WebexRequest.

### MOD-006 — Agent path qualification

- Qualify `getStationLoginErrorData` to `src/services/core/Utils.ts`.

### MOD-007 — Task state-machine applicability

- State that the pure XState layer owns no credentials/authentication.
- State that UIControlConfig values are Task-supplied capability configuration, not state-machine-owned rollout evaluation.
- State that logging and metrics are owned by Task/TaskManager; the state-machine source has no LoggerProxy or MetricsManager dependency.

### MOD-008 — Utils applicability

- State that PageCache receives already-fetched values, owns no credentials/authentication, and keeps organization-separated in-memory cache keys.
- State that PageCache has no rollout flag; consuming services decide whether to call it and query parameters determine cache eligibility.

## Feasibility & Risks

- **Feasibility:** High; every change is documentation-only and directly evidenced by current source.
- **Spikes needed:** None.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| An N/A statement overclaims absence | low | high | search imports/constructors and cite the owning source file |
| Legacy source-fidelity proof is displaced | medium | medium | rerun all 12 inventories and reconcile only failed units |
| Coverage is mistaken for promotion authority | medium | high | retain all manifest statuses and produce draft-only promotion analysis |

## Interaction / Scenario Matrix

| Scenario | Expected documentation result | Covered by |
|---|---|---|
| Host-authenticated service request | Services/Task inherit identity through Core; no duplicate credential ownership | MOD-001, MOD-005 |
| Config profile aggregation | All ten dependent results, including AI feature flags, appear in primary and secondary material | MOD-002 |
| State change through AqmReqs | Example uses outer event, nested success/failure event, PUT, and `{data}` payload | MOD-003 |
| Metrics taxonomy review | Every section agrees on 80 total, 71 mapped, 9 unmapped | MOD-004 |
| Pure state transition | State machine applies Task-supplied config/actions while Task owns telemetry/auth integration | MOD-007 |
| Page cache use | Consuming service owns remote/auth decision; cache only owns eligibility/key/TTL/data | MOD-008 |

## Documentation Obligations

- Apply MOD-001 through MOD-008 only to the named protected module specs.
- Update source-fidelity dispositions only where exact migrated excerpts move.
- Write a new conformance report and a new coverage report/trend entry.
- Update every measured module's coverage metadata and current validation status without citing local report paths.
- Do not edit or promote `.sdd/manifest.json`.

## Spec State

| Section | State |
|---|---|
| Problem, scope, requirements, acceptance | complete and approved |
| Protected-target reconciliation | append as approved MODIFIED delta |
| Canonical application | complete |
| Source fidelity / conformance / coverage | complete / PASS / 100% |
| Independent clean revalidation | complete — PASS with 0 Blocking and 0 warnings |

## Change Log

| Date | Change | By | Why |
|---|---|---|---|
| 2026-07-07 | Created pre-approved residual-warning and coverage-completion delta | Codex + developer | Continue rigorous onboarding after PASS WITH WARNINGS without promoting the manifest |
| 2026-07-07 | Applied MOD-001 through MOD-008; source fidelity and conformance PASS; coverage reached 9/9 and 135/135 | Codex | Clear residual contradictions and complete the approved coverage loop without manifest promotion |
| 2026-07-07 | Recorded clean independent revalidation PASS and closed validation metadata | Codex + Claude validator | Confirm the approved delta at 0 Blocking and 0 warnings while leaving the manifest unpromoted |

## References

- Package architecture: [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)
- Module router: [`SPEC_INDEX.md`](../../../SPEC_INDEX.md)
- Runtime evidence: `src/` and `test/`
- Independent revalidation input: local validator audit report retained outside the committed canonical evidence surface
