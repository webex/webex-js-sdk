<!-- sdd-generated-metadata
doc_kind: reference-doc
generated_from: adr@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-09-08T00:00:00Z
validation_status: not-run
-->
# ADR-0001 — Migrate existing meetings docs into canonical SDD docs

> Root [`AGENTS.md`](../../AGENTS.md) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../ARCHITECTURE.md).

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-18 |
| Deciders | repository owner and generator runtime |
| Supersedes / Superseded by | none |
| Generated from | `adr` @ SDLC template library `0.2.2` |

## Context

The package already contained an agent rule, a long consumer README, an upgrade guide, contributor guidance, and feature READMEs for breakouts, simultaneous interpretation, and AI-enablement approval. The rigorous brownfield workflow requires one canonical routed SDD surface without silently discarding reviewed intent. Current source and tests must remain behavioral truth, and the repository owner explicitly excluded commit/PR history from current-behavior evidence. Evidence: `AGENTS.md`, `README.md`, `UPGRADING.md`, `internal-README.md`, `src/breakouts/README.md`, `src/interpretation/README.md`, `src/aiEnableRequest/README.md`, `.sdd/manifest.json`.

## Decision

Use `migrate-existing`. Reorganize supported source content by meaning into the package-level `ai-docs/` standing documents and 23 source-local module specifications. Update the existing root `AGENTS.md` in place from its frozen checkpoint. Retain every legacy document unchanged after migration; do not delete or rewrite it. Where retained prose conflicts with current code, record the unit as corrected/stale and use current source/tests in the canonical spec.

### Recorded spec-source policy

This ADR is the durable decision record referenced by `.sdd/manifest.json` (`spec_source_policy.decision_record` and each module's `spec_sources[].decision_record`). The recorded fields resolve as follows.

| Manifest field | Value | Recorded here by |
|---|---|---|
| `mode` | `migrate-existing` | the Decision section above |
| `migrated_source_disposition` | `retain` | "Retain every legacy document unchanged after migration" |
| `decided_by` / `disposition_decided_by` | repository user | the Deciders row |
| `decided_at` / `disposition_decided_at` | 2026-08-18 | the Date row |

Each module also carries its own `source_policy`. A module records `migrate-existing` only when it had a pre-existing document to migrate — `src/meeting/` (`UPGRADING.md`), `src/breakouts/`, `src/interpretation/`, and `src/aiEnableRequest/` (their feature `README.md` files) — and the remaining 19 modules record `keep-separate` because there was nothing to migrate, not because a different policy was chosen for them. The single `conflict_status: resolved` entry is `src/breakouts/`, resolved as described above: the stale retained claim was superseded by current source and tests while the README itself was retained.

Reconciling a protected spec or a recorded source conflict therefore reads this committed file; no untracked working directory is required.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| keep separate | no migration work | agents must choose between multiple documentation surfaces and legacy gaps remain | repository owner selected canonical migration |
| reconcile each conflict interactively | explicit conflict-by-conflict control | unnecessary for the one known stale breakout claim and old contributor commands once current-code authority was confirmed | current code/test authority and retention policy resolve these cases |
| migrate and delete old docs | one visible surface | loses stable consumer examples and historical upgrade context | repository owner explicitly chose retention |

## Consequences

- **Positive:** agents have a manifest-routed package index and source-local specs while supported legacy meaning remains represented.
- **Negative / cost:** retained docs can continue to drift and must be treated as migration/reference inputs rather than canonical behavior.
- **Agents must:** use `SPEC_INDEX.md` and `.sdd/manifest.json`, cross-check Partial/Untracked specs against current code, and update canonical docs with behavior changes.

## Revisit When

- The retained docs are deliberately retired, the module tree changes materially, or an independent validator finds unresolved source-fidelity conflicts.
