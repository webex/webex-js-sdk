---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-13T02:20:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T02:56:49Z
validation_status: pass-with-warnings
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

Onboarding found one existing document, `README.md`. It is the npm page: a one-line description
("Attachment Actions plugin for the Cisco Webex JS SDK."), install commands, a pointer to the developer
portal and API docs, and Usage headings. No other intent, design, or AI-authored spec exists in this
package.

The README states almost nothing about behavior, and part of what it states is wrong:

| README content | Code |
| -------------- | ---- |
| The title heading is `@webex/plugin-messages` | `package.json` names the package `@webex/plugin-attachment-actions` |
| The Install and Usage sections each appear twice; the second Usage section is empty | — |
| No example and no method name | `create`, `get`, `listen`, and the `created` event are in `src/attachmentActions.js` |
| Nothing about scopes | The `listen` JSDoc in `src/attachmentActions.js` requires `spark:all` and `spark:kms` |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Correcting its heading and filling it in is a product-doc change,
not a requirement of making the package SDD-ready, and the other onboarded packages in this workspace
kept their READMEs the same way. It makes no behavioral claim that the module specification would need
to carry, so nothing is lost by not migrating it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | It holds no behavior to migrate; deletion was not requested |
| Reconcile the README with the module specification in place | There is nothing to reconcile beyond the package name; the developer's precedent is `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as a reference; its title names another package.
- The wrong heading and the repeated sections remain until a maintainer makes a separate product-doc
  change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may fix the title heading, remove the repeated sections, and add examples for
  `create`, `get`, and `listen()` in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to document the methods or the `created` event.

## References

- `README.md`
- `src/index.js`
- `src/attachmentActions.js`
- `.sdd/manifest.json` `spec_source_policy`
