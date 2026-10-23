---
type: ADR
title: ADR-0001 - Retain the product README
description: The package README.md stays product documentation and is not routed as a spec source.
tags: [adr]
timestamp: 2026-10-12T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-22T06:52:30Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-12 |
| Deciders      | riag@cisco.com (SPARK-853119) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

The package has one existing document, `README.md`. It is the npm usage page. It shows installation
and a usage block that imports the package, builds a `WebexCore`, and ends in the placeholder
`webex.internal.user.WHATEVER`. It describes no method, property, or config key.

The implementation in `src/` has the uuid resolution methods, the batched lookup and its cache, the
account flows (`verify`, `activate`, one-time passwords), the password and name updates, the
preferred meeting site update, the `hasPassword` property, and the `config.user` defaults. No other
intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is silent, code wins.

## Why

The README is the npm-facing page and states no behavior to migrate. Rewriting it is a product-doc
change, not a requirement of making the package SDD-ready.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | The page is retained product documentation, it holds no behavior to migrate, and deletion was not requested |
| Expand the README alongside the specifications | The README is the npm-facing page; changing it is a product-doc change, separate from the specifications |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the list of methods or config keys.
- The README placeholder `WHATEVER` stays until a separate product-doc change replaces it.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required.

## Revisit when

- A maintainer chooses to document the methods or config defaults on the npm page.

## References

- `README.md`
- `src/index.js`
- `src/user.js`
- `.sdd/manifest.json` `spec_source_policy`
