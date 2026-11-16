---
type: ADR
title: ADR-0001 - Migrate existing meetings docs into canonical SDD docs
description: The meetings plugin migrates its existing docs by meaning into one canonical, manifest-routed SDD set, with code and tests as behavioral truth.
tags: [adr]
timestamp: 2026-08-18T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T14:30:00Z
validation_status: not-run
-->

# ADR-0001 - Migrate existing meetings docs into canonical SDD docs

| Field         | Value |
| ------------- | ----- |
| Status | Accepted |
| Decision date | 2026-08-18; reconfirmed 2026-11-16 |
| Deciders | repository owner (2026-08-18); rarajes2@cisco.com (reconfirmed 2026-11-16, in chat) |
| Supersedes | None |
| Superseded by | None |

## Context

The package already contained an agent rule, a long consumer README, an upgrade guide, contributor
guidance, and feature READMEs for breakouts, simultaneous interpretation, and AI-enablement approval.
The rigorous brownfield workflow requires one canonical routed SDD surface without silently
discarding reviewed intent. Current source and tests must remain behavioral truth, and the
repository owner explicitly excluded commit/PR history from current-behavior evidence. Evidence:
`AGENTS.md`, `README.md`, `UPGRADING.md`, `internal-README.md`, `src/breakouts/README.md`,
`src/interpretation/README.md`, `src/aiEnableRequest/README.md`, `.sdd/manifest.json`.

The first migration, on 2026-08-18, produced a package-level `ai-docs/` set and one
`src/<module>/ai-docs/` specification per module. That layout predates the repo-standards templates
that the workspace root orchestrator now routes packages through.

## Decision

Use `migrate-existing`. Reorganize supported source content by meaning into the package-level
standing documents under `docs/` (`docs/architecture.md`, `docs/getting-started.md`,
`docs/specs/README.md`, `docs/index.md`, and this ADR registry), the root `AGENTS.md`, and 23
source-local module specifications at `src/<module>/docs/README.md`. Update the existing root
`AGENTS.md` in place from its frozen checkpoint, keeping its human-authored guidance. Retain every
human-authored legacy document (`README.md`, `UPGRADING.md`, `internal-README.md`, and the feature
READMEs) unchanged as context; do not delete or rewrite them. Where retained prose conflicts with
current code, record the unit as corrected/stale and use current source/tests in the canonical spec.

The generated `ai-docs/` set from the first migration is itself a migration input. After its content
is migrated and reviewed, it is deleted (`delete-after-validation`).

### Recorded spec-source policy

This ADR is the durable decision record referenced by `.sdd/manifest.json`
(`spec_source_policy.decision_record` and each module's `source_policy.decision_record`). The recorded
fields resolve as follows.

| Manifest field | Value | Recorded here by |
|---|---|---|
| `mode` | `migrate-existing` | the Decision section above |
| `migrated_source_disposition` | `delete-after-validation` | "After its content is migrated and reviewed, it is deleted" for the generated `ai-docs/` set; "Retain every human-authored legacy document" unchanged |
| `decided_by` / `disposition_decided_by` | rarajes2@cisco.com (confirmed in chat) | the Deciders row |
| `decided_at` / `disposition_decided_at` | 2026-11-16T13:50:45Z | the Decision date row |

Each module also carries its own `source_policy`. All 23 modules record `migrate-existing`, because
each had a routed `ai-docs` module specification to migrate, and every module records
`conflict_status: none`. The `src/breakouts/` stale retained claim was superseded by current source
and tests while its README itself was retained. The human-authored READMEs and `UPGRADING.md` are
routed in `spec_sources` as `reference-only`, `context-only` documents that are retained.

Reconciling a protected spec or a recorded source conflict therefore reads this committed file; no
untracked working directory is required.

## Why

Agents need one manifest-routed documentation surface. Migrating by meaning keeps the reviewed intent
of the existing documents, while code and mirrored tests stay the behavioral source of truth, so a
stale legacy claim is corrected rather than carried forward.

## Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| keep separate | no migration work | agents must choose between multiple documentation surfaces and legacy gaps remain | repository owner selected canonical migration |
| reconcile each conflict interactively | explicit conflict-by-conflict control | unnecessary for the one known stale breakout claim and old contributor commands once current-code authority was confirmed | current code/test authority and retention policy resolve these cases |
| migrate and delete old docs | one visible surface | loses stable consumer examples and historical upgrade context | repository owner explicitly chose retention |

## Consequences

**Positive:**

- Agents have a manifest-routed package index and source-local specs while supported legacy meaning
  remains represented.

**Negative / tradeoffs:**

- Retained docs can continue to drift and must be treated as reference inputs rather than canonical
  behavior.

**Current consequences (2026-11-16):**

- rarajes2@cisco.com reconfirmed `migrate-existing` for this package.
- The docs moved from the `ai-docs/` layout to the repo-standards layout (`docs/`, `AGENTS.md`, and
  `src/<module>/docs/README.md`), with the package routed from the workspace root orchestrator
  manifest (`../../../.sdd/manifest.json`, via `layout.monorepo_package` in `.sdd/manifest.json`); the
  templates live once at the monorepo root.
- rarajes2@cisco.com approved deleting the old `ai-docs/` set after review, recorded as
  `migrated_source_disposition: delete-after-validation`. The human-authored legacy documents stay
  retained.

## Constraint on future changes

Agents must use `docs/specs/README.md` and `.sdd/manifest.json`, cross-check Partial/Untracked specs
against current code, and update canonical docs with behavior changes. Do not delete the retained
human-authored documents as part of spec maintenance, and do not recreate an `ai-docs/` layout.

## Follow-up

- [x] Delete the old `ai-docs/` set after the migrated docs pass review (done 2026-11-16 after rarajes2@cisco.com reviewed the migration).
- [ ] Specify `src/common/`, `src/e2ee/`, and `src/transcription/`, which have no module specification.
- [ ] Run coverage review and independent validation before promoting any module beyond `Partial`.

## Revisit when

- The retained docs are deliberately retired, the module tree changes materially, or an independent
  validator finds unresolved source-fidelity conflicts.

## References

- `.sdd/manifest.json` `spec_source_policy`, `spec_sources`, and `modules[].source_policy`
- `AGENTS.md`
- `README.md`
- `UPGRADING.md`
- `internal-README.md`
- `src/breakouts/README.md`
- `src/interpretation/README.md`
- `src/aiEnableRequest/README.md`
