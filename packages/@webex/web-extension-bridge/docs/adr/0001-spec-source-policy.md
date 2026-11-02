---
type: ADR
title: ADR-0001 - Reconcile existing docs; retain README and SECURITY
description: Stage 0 spec-source policy is reconcile with retain. Product README and SECURITY stay in place; the repo-root intake spec cannot be a package spec_sources path.
tags: [adr]
timestamp: 2026-09-16T10:06:00Z
status: accepted
---
<!-- ───────────────────────────────
  Template:     Architecture Decision Record
  Template-ID:  adr
  Generates:    docs/adr/NNNN-<kebab-title>.md
  Description:  Resolved from WebexTools/repo-standards templates/docs/adr/NNNN-decision-title.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/docs/adr/NNNN-decision-title.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# ADR-0001 - Reconcile existing docs; retain README and SECURITY

| Field         | Value                                         |
| ------------- | --------------------------------------------- |
| Status        | Accepted                                      |
| Decision date | 2026-09-16                                    |
| Deciders      | SPARK-853132 ticket owner                     |
| Supersedes    | N/A                                           |
| Superseded by | N/A                                           |

## Context

Stage 0 onboarding found existing product docs (`README.md`, `SECURITY.md`) and a repo-root intake spec at `WEB-EXTENSION-BRIDGE-INTAKE-SPEC.md`. The package sdd-root cannot list `..` paths in `spec_sources`. Code wins over intake where they disagree.

## Decision

`spec_source_policy.mode` is `reconcile`. `migrated_source_disposition` is `retain`. Product `README.md` and `SECURITY.md` stay in the package. Architecture facts that still match code were reconciled into `docs/architecture.md`. The intake spec remains at the JS SDK repo root and is not a package `spec_sources` path. `SECURITY.md` is reused via `layout.artifact_decisions`.

## Why

Reconcile plus retain keeps the published product docs byte-for-byte while making the SDD tree the agent-facing canonical set. Deleting README/SECURITY would overwrite product surfaces this Stage 0 pass is not allowed to change.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| `keep-separate` | Would leave agents with two competing canonical sets. |
| `migrate-existing` plus `delete-after-validation` | Would remove or replace README/SECURITY, which Stage 0 must retain. |
| Point `decision_record` at `.generated/sdd/` | That tree is gitignored (`/**/.generated/`) and is not inspectable on a clone. |

## Consequences

**Positive:**

- Agents can read the policy from a committed path.
- Product README/SECURITY remain the published surfaces.

**Negative / tradeoffs:**

- Product README can still disagree with SDD where intake or README has drifted; code wins, and those product files are not rewritten in this pass.

## Constraint on future changes

Do not delete or overwrite package `README.md` or `SECURITY.md` as part of Stage 0 annotation. Do not add the repo-root intake spec as a package `spec_sources` path.

## Follow-up

- [x] Record the policy in `.sdd/manifest.json` `spec_source_policy`
- [x] Point `decision_record` at this ADR

## Revisit when

A later stage is authorized to replace or delete the product README/SECURITY, or the intake spec is moved inside the package sdd-root.

## References

- [SPARK-853132](https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-853132)
- `.sdd/manifest.json` `spec_source_policy`
- [package architecture](../architecture.md)
