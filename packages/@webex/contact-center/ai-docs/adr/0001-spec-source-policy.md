# ADR-0001 — Migrate legacy Contact Center AI docs into canonical SDD specs

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-07 |
| Deciders | Package maintainer / user |
| Supersedes / Superseded by | none |

## Context

The Contact Center package already contained module-local `AGENTS.md`, `ARCHITECTURE.md`, pattern, and workflow documents before canonical SDD specifications were introduced. Those files contain useful intent and examples, but allowing them to remain co-equal with the generated `*-spec.md` files would make documentation routing ambiguous and could preserve statements that have drifted from `src/**` and `test/**`.

The source inventory and canonical targets are recorded in `packages/@webex/contact-center/.sdd/manifest.json`. Code and tests remain the behavioral referee for every migrated statement.

## Decision

Use the `migrate-existing` source policy.

- Preserve relevant legacy content by meaning in the canonical SDD specification for each module.
- Treat manifest-routed legacy documents as reference-only migration sources, not canonical specifications.
- Route agents through `.sdd/manifest.json` and `ai-docs/SPEC_INDEX.md` to the canonical target.
- Retain legacy files with a banner pointing to their canonical target; if documentation conflicts with code or tests, code and tests win.

The SDD route replaces the former package-local workflow, classification summary, specification-summary gate, and service-routing tables with one sequence: read package `AGENTS.md`, select the owning spec through `SPEC_INDEX.md`, verify requirements against source/tests, obtain approval for the affected files/contracts, update code and its owning spec together, and run generator-side conformance plus independent semantic validation before staging.

| Module | Canonical target |
|---|---|
| `src` | `ai-docs/contact-center-spec.md` |
| `src/metrics` | `src/metrics/ai-docs/metrics-spec.md` |
| `src/services` | `src/services/ai-docs/services-spec.md` |
| `src/services/agent` | `src/services/agent/ai-docs/agent-spec.md` |
| `src/services/config` | `src/services/config/ai-docs/config-spec.md` |
| `src/services/core` | `src/services/core/ai-docs/core-spec.md` |
| `src/services/task` | `src/services/task/ai-docs/task-spec.md` |
| `src/services/task/state-machine` | `src/services/task/state-machine/ai-docs/task-state-machine-spec.md` |
| `src/utils` | `src/utils/ai-docs/utils-spec.md` |

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Keep legacy and SDD docs separate and co-equal | No migration work | Agents must choose between competing authorities; drift remains likely | Does not establish deterministic routing |
| Reconcile every legacy document in place | Preserves familiar paths | Keeps multiple canonical shapes and complicates validation | The package needs one template-compatible SDD surface |
| Delete legacy documents after migration | Removes ambiguity | Loses useful historical examples and context | Reference material remains valuable when clearly marked noncanonical |

## Consequences

- **Positive:** Each module has one machine-routed canonical specification and a durable, reviewable policy record.
- **Negative / cost:** Retained legacy documents require reference-only banners and must not be updated as independent authorities.
- **Agents must:** Read the manifest and `SPEC_INDEX.md`, open the canonical `*-spec.md`, and cross-check behavior against source and tests.

## Revisit When

- A module is promoted from `Partial` to `Specced`, a canonical target is relocated, or a legacy file is proposed for removal.
