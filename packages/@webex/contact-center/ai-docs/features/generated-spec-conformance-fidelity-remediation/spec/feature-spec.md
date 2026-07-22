# Feature Spec — Generated Spec Conformance and Fidelity Remediation

> Start here → package root [`AGENTS.md`](../../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ARCHITECTURE.md). This is a documentation-only protected-spec delta. It authorizes canonical documentation corrections but no runtime, test, or manifest change.

## Metadata

| Field | Value |
|---|---|
| Feature / ticket key | `CC-SDD-CONFORMANCE-FIDELITY-20260709` |
| Title | Generated module-spec conformance and source-fidelity remediation |
| Status | applied; generator-side source fidelity, conformance, and coverage pass; independent validation pending |
| Change class | documentation-only MODIFIED conformance and fidelity correction |
| created_by / approved_by / date | Codex generator / developer / 2026-07-09 |
| Generated from | `feature-spec` @ SDLC template library `0.2.1` |

## Problem & Goal

The prior deterministic conformance pass checked section presence but did not verify that sequence-inventory rows mapped to actual operation-specific diagrams, that migrated diagrams appeared in the canonical section selected by meaning, or that every required section remained concrete after migration. A read-only brownfield audit found cross-module structural and source-fidelity gaps despite clean semantic validation metadata.

The goal is to make all nine module specs satisfy the full module-spec output contract while preserving current source behavior and routed legacy detail.

## Scope

In scope:

- Repair sequence inventories, diagram placement, operation coverage, and error/timeout/retry/recovery branches.
- Correct Task AQM completion semantics and Utils cache-key scope semantics from current source.
- Add complete requirement-to-test mappings.
- Replace generic pitfalls and module conventions with code-grounded module-specific content.
- Remove stale validation-pending text and superseded local-doc routing artifacts.
- Normalize mechanically fragmented tables without dropping rows.
- Reconcile diagram dispositions in source-fidelity inventories and rerun generator-side gates.

Out of scope:

- Runtime source or test changes.
- Public API, event, behavior, transport, timeout, or compatibility changes.
- `.sdd/manifest.json` edits or coverage-status promotion.
- Independent validator acceptance on the generator runtime.

## Requirements

| ID | WHAT | WHY | Acceptance | State |
|---|---|---|---|---|
| REMEDIATION-R-001 | Every Sequence Diagram(s) inventory must map each distinct operation group to an actual titled diagram or an explicitly justified shared diagram. | A table that advertises uncovered flows is not actionable documentation. | Coverage rows and diagrams agree; distinct failure/state outcomes are diagrammed. | Approved |
| REMEDIATION-R-002 | Migrated flow, sequence, class, and state diagrams must appear in the canonical section selected by meaning and remain one-for-one unless code requires a recorded correction. | Source fidelity cannot be satisfied by retaining valid detail only in superseded documents. | Diagram inventory targets/statuses and canonical placement agree. | Approved |
| REMEDIATION-R-003 | Every module test strategy must map every requirement ID to concrete test files and an explicit remaining gap. | Prose-only testing guidance cannot prove requirement coverage. | Nine complete requirement-to-test matrices. | Approved |
| REMEDIATION-R-004 | Pitfalls and module conventions must name module-specific failure modes, ownership boundaries, constants, events, or lifecycle constraints. | Generic boilerplate is not evidence-backed maintenance guidance. | No repeated generic ownership/raw-string boilerplate remains. | Approved |
| REMEDIATION-R-005 | Correct Task AQM and Utils cache-key descriptions to current source behavior. | The existing Task diagram treats HTTP acknowledgement as completion, and Utils overstates `orgId` as the only runtime scope key. | AQM resolves on matched WebSocket completion; cache scope records `orgId` or `bookId` by consumer. | Approved |
| REMEDIATION-R-006 | Remove stale validation-pending cells and legacy “this file”/superseded-doc navigation from canonical specs. | Canonical docs must describe their current status and route readers to canonical surfaces. | Metadata and requirement gap cells agree; no module-local legacy doc is presented as canonical. | Approved |
| REMEDIATION-R-007 | Preserve all current table rows while consolidating repeated one-row table fragments. | Mechanical migration fragmentation harms reviewability and can conceal omissions. | Repeated adjacent identical table headers are consolidated without data loss. | Approved |

## MODIFIED Requirements

### MOD-001 — Contact Center

Name and map its four lifecycle sequence diagrams, add the bootstrap rejection branch, complete concrete pitfalls/conventions, and retain its full requirement-to-test matrix.

### MOD-002 — Metrics

Preserve the two legacy sequences, add explicit disabled/submission-error coverage, complete the test matrix, and normalize event/taxonomy tables.

### MOD-003 — Services

Add the missing direct-REST sequence, use the three-column sequence inventory, complete the test matrix, and remove copied legacy-file identity text.

### MOD-004 — Agent

Restore code-supported station-login, state-change, WebSocket-event, and relogin detail; add logout/buddy coverage; correct legacy diagram dispositions; and complete the test matrix.

### MOD-005 — Config

Keep the corrected ten-result profile aggregation, add pagination coverage, complete the test matrix, and normalize API/type tables.

### MOD-006 — Core

Add authenticated REST coverage, diagram duplicate-pending/offline retry behavior, identify private helpers as internal, correct diagram dispositions, and complete the test matrix.

### MOD-007 — Task

Move legacy sequences from Data Flow to Sequence Diagram(s), correct AQM completion, add all five operation-group diagrams, and complete the test matrix.

### MOD-008 — Task state machine

Add group-specific sequences for offer/assignment, hold/resume, consult, conference/transfer, wrapup/termination, and hydration; preserve exact state diagrams; complete the test matrix.

### MOD-009 — Utils

Describe the caller-supplied cache scope accurately, add lookup/store and clear sequences with backend failure behavior, correct legacy diagram disposition, and complete the test matrix.

### MOD-010 — Cross-module audit state

Refresh source-fidelity dispositions, conformance evidence, validation metadata/gap wording, local navigation, and decision logs without modifying the manifest.

## Acceptance Criteria

- All nine specs pass template/profile/heading/link/placeholder checks.
- Every sequence inventory maps to actual diagrams with applicable failure/recovery behavior.
- No sequence diagram remains in Task Data Flow.
- Task AQM diagrams distinguish HTTP acknowledgement from WebSocket settlement.
- Utils documents the real consumer scope (`orgId` for EntryPoint/Queue; `bookId` for AddressBook).
- Every requirement ID appears in its module's test-strategy matrix.
- No runtime/test file changes and manifest hash remains unchanged.
- Generator-side source-fidelity and conformance pass before independent validator handoff.

## Change Log

| Date | Change | By | Why |
|---|---|---|---|
| 2026-07-09 | Created and approved MOD-001 through MOD-010 | Codex + developer | Repair all-module brownfield conformance and source-fidelity gaps found by read-only audit |
| 2026-07-09 | Applied remediation and completed generator-side gates | Codex | 12/12 fidelity inventories, 9/9 module conformance, and 9/9 coverage pass; manifest unchanged |

## References

- Current behavior: `src/` and `test/`
- Canonical routing: [`SPEC_INDEX.md`](../../../SPEC_INDEX.md)
- Public contract index: [`CONTRACTS.md`](../../../CONTRACTS.md)
