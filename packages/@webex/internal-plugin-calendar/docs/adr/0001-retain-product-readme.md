---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T07:53:58Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T08:24:55Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-12 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found one existing document, `README.md`. It is the npm usage page: an install command, an
import of the package, and a usage block that reads `webex.internal.calendar.WHATEVER`, which is a
placeholder rather than an API. It lists no method, event, or error.

The implementation in `src/calendar.js` has lifecycle, sync, read, write, scheduler-data, and
free-busy methods and emits five `calendar:*` events named in `src/constants.js`. The README describes
none of them. No other intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. Where the README is silent or generic, code wins.

## Why

The README is the npm-facing page and carries no behavioral claim that the module specification would
need to preserve. Rewriting it is a product-doc change, not a requirement of making the package
SDD-ready. The sibling packages `@webex/internal-plugin-feature` and `@webex/internal-plugin-user`
made the same choice for the same README shape.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | The page holds no behavioral content to migrate, and deletion was not requested |
| Reconcile the README with the module specification in place | Nothing in it needs reconciling, and the npm page would gain spec-only detail |
| Replace the README placeholder with real usage during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the list of methods or events.
- The `WHATEVER` placeholder in the README stays until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required for onboarding.

## Revisit when

- A maintainer chooses to document the plugin methods and events on the npm page.

## References

- `README.md`
- `src/index.js`
- `src/calendar.js`
- `src/constants.js`
- `.sdd/manifest.json` `spec_source_policy`
