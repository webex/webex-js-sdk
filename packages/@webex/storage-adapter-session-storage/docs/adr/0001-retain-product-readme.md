---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-13T05:50:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T06:13:09Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-13 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found one existing document, `README.md`. It is the npm page: a readme-style badge, a
one-line description, an install command, a pointer to the developer portal and API docs, and
maintainer, contributing, and license sections. No other intent, design, or AI-authored spec exists
in this package, and no `AGENTS.md` existed.

The README makes one behavioral claim, and it does not match the code:

| README content | Code |
| -------------- | ---- |
| The description reads "localStorage adapter for the Cisco Webex JS SDK" | `src/index.js` reads, writes, and removes `sessionStorage` entries and logs with the prefix `session-storage-store-adapter:` |
| The table of contents lists Install, Usage, Contribute, Maintainers, and License | The Usage section only links to the developer portal; it shows no constructor or method |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Correcting its description is a product-doc change, not a
requirement of making the package SDD-ready, and the other onboarded packages in this workspace kept
their READMEs the same way. It holds no behavior the specification lacks, so nothing is lost by not
migrating it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | It holds no behavior to migrate; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would only carry the wrong storage name; the developer chose `keep-separate` |
| Correct the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- The npm page keeps calling the package a localStorage adapter until a maintainer changes it.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may change the README description to "sessionStorage adapter" and add a usage
  example in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README.

## References

- `README.md`
- `src/index.js`
- `.sdd/manifest.json` `spec_source_policy`
