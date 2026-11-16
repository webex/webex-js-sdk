---
type: ADR
title: ADR-0001 - Migrate the legacy AI documentation into the repo-standards layout
description: The package's older ai-docs folders are migrated by meaning into the repo-standards documents and then deleted.
tags: [adr]
timestamp: 2026-11-16T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T14:00:00Z
validation_status: not-run
-->

# ADR-0001 - Migrate the legacy AI documentation into the repo-standards layout

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-16 |
| Deciders      | rarajes2@cisco.com (confirmed in chat) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

The package was onboarded to spec-driven development in July 2026 with an older Repo Annotation
generator. That generator wrote 15 `ai-docs/` folders: one at the package root (architecture,
contracts, rules, patterns, glossary, security, service state, getting started, a spec index, and
agent task templates), one under `src/` for the package source guide, and one inside each of the 13
modules (an agent guide, an architecture page, and a module spec). The monorepo now routes every
onboarded package from a root orchestrator that expects the repo-standards 0.3.0 layout: a package
`AGENTS.md`, standing documents under `docs/`, a module specification at each module's
`docs/README.md`, and a `.repo-context.json`. The legacy folders matched none of those paths, so the
root orchestrator could not route the package.

## Decision

Migrate the legacy content by meaning (`spec_source_policy.mode: migrate-existing` in
`.sdd/manifest.json`) into:

- the package `AGENTS.md`, merged in place, for commands, rules, coding conventions, the review
  checklist, and the calling-specific steps of the old task templates;
- `docs/index.md`, `docs/architecture.md`, `docs/getting-started.md`, `docs/specs/README.md`, and
  this ADR set for package-wide material;
- the `docs/README.md` beside each of the 13 modules' code; and
- `.repo-context.json` for agent operational context.

Every legacy content unit is accounted for in a local source-fidelity inventory: placed, corrected
against code, or dispositioned with a reason. After the reviewed migration is committed, every
`ai-docs/` folder under the package is deleted in a separate, final commit
(`migrated_source_disposition: delete-after-validation`).

## Why

One canonical home per fact. Keeping the legacy folders beside the new documents would leave two
competing sources for the same behavior, and agents would keep loading the stale one. Migrating by
meaning, instead of regenerating from code alone, keeps the reviewed detail (state machines, event
catalogs, failure paths, and rationale) that the July onboarding captured.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Keep the legacy folders separate and regenerate new documents from code | Loses reviewed rationale and flow detail, and leaves two documentation sets to drift apart |
| Reconcile legacy and new documents side by side | Requires a human decision for every overlap; the legacy set has no independent owner to arbitrate |
| Keep the pattern guides and task templates as extra files | The repo-standards layout has no patterns or templates destination, and the root orchestrator would not route them |

## Consequences

**Positive:**

- The package is routed by the monorepo root orchestrator like its siblings.
- Each module has exactly one specification, beside its code.

**Negative / tradeoffs:**

- Long illustrative code examples from the old pattern guides and the generic steps of the old task
  templates are not carried forward; their calling-specific rules are.
- Old links into `ai-docs/` paths break after the deletion commit.

## Constraint on future changes

Do not recreate `ai-docs/` folders or add documentation outside the manifest-routed paths. New module
behavior goes into that module's `docs/README.md`; package-wide facts go into `docs/architecture.md`;
coding rules go into `AGENTS.md`.

## Follow-up

- [ ] Run independent spec validation in a different runtime and record the result in the manifest.
- [ ] Rerun coverage review for the 13 module specifications.

## Revisit when

- The repo-standards template set adds a destination for pattern guides or agent task templates.

## References

- [Specification registry](../specs/README.md)
- [Package architecture](../architecture.md)
