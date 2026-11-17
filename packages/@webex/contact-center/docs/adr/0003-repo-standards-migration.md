---
type: ADR
title: ADR-0003 - Repo-standards migration
description: Migrate the earlier generated SDD documentation of @webex/contact-center into the repo-standards layout and delete the older documentation folders after review.
tags: [adr]
timestamp: 2026-11-16T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T00:00:00Z
validation_status: blocked
-->

# ADR-0003 - Repo-standards migration

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-16 |
| Deciders      | rarajes2@cisco.com (confirmed in chat) |
| Supersedes    | [ADR-0001 - Spec source policy](0001-spec-source-policy.md) |
| Superseded by | N/A |

## Context

[ADR-0001](0001-spec-source-policy.md) made the earlier generated module specifications canonical and
kept the hand-written module guides beside them as reference-only material. Those specifications,
the package-wide architecture, contract, glossary, security, service-state, rules, pattern, and
template documents, and three earlier feature records all lived in documentation folders of an older
Repo Annotation layout. The monorepo root now holds one Repo Standards template set
(`../../../.sdd/templates/repo-standards`) that every onboarded package uses, and the older layout
leaves this package with two documentation shapes.

## Decision

Use the `migrate-existing` source policy again, this time into the repo-standards layout:

- Each of the nine manifest modules keeps its path; its canonical specification moves to the
  `docs/README.md` file inside the module directory, listed in the
  [Module registry](../specs/README.md#module-registry).
- Package-wide content moves by meaning into the standing documents under `docs/`
  ([architecture](../architecture.md), [getting started](../getting-started.md),
  [specification registry](../specs/README.md), and these ADRs), into `.repo-context.json`, and
  into the package [`AGENTS.md`](../../AGENTS.md), which is merged in place.
- The consult and transfer list policy becomes [ADR-0002](0002-consult-transfer-list-policy.md).
- `src/utils/AGENTS.md` is retained as reference-only context; the Utils module specification is
  canonical.
- Every claim is checked against `src/` and `test/unit/spec` before it is carried; stale claims are
  corrected or recorded as stale in the local source-fidelity inventories.
- The older documentation folders are deleted after source fidelity, conformance, the checkers, and
  the user's review of the diff, in a separate final commit.

## Why

One template set across the monorepo gives agents and reviewers the same document shapes in every
package, and deleting the older folders after review removes the second documentation family that
ADR-0001 had to keep marked as reference-only.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Keep the older layout beside the repo-standards documents (`keep-separate`) | Two documentation families with overlapping authority stay in the package |
| Reconcile the older documents in place (`reconcile`) | Keeps the older document shapes, which the root templates do not generate or check |
| Keep the older files with reference-only banners, as ADR-0001 did | The repo-standards documents carry the content by meaning, so the banners only preserve drift |

## Consequences

**Positive:**

- One canonical specification per module beside its code, and one standing-document set under
  `docs/`, all generated from the root Repo Standards templates.
- No reference-only copies of migrated content remain once the deletion commit lands.

**Negative / tradeoffs:**

- History that lived only in the older documents (earlier correction records and onboarding
  metadata) is kept in the local source-fidelity inventories, not in committed documents.
- Coverage states are carried, not reassessed, until a fresh coverage review runs.

## Constraint on future changes

Change a module's behavior together with its `docs/README.md` specification and, for a contract,
the architecture contract index and `.sdd/manifest.json`. Do not reintroduce a parallel
documentation folder; code and tests remain the behavioral referee.

## Follow-up

- [ ] Delete the older documentation folders in a separate commit after the user reviews the diff.
- [ ] Run a coverage review and an independent validation on another runtime.

## Revisit when

- The root Repo Standards templates change their layout, or a module is added, split, or moved.

## References

- `.sdd/manifest.json` `spec_source_policy`, `spec_sources`, and `template_migration`
- [ADR-0001 - Spec source policy](0001-spec-source-policy.md)
- [Specification registry](../specs/README.md)
