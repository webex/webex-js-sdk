---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T17:25:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:50:02Z
validation_status: pass
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

Onboarding found one existing document, `README.md`. It is the npm page: a one-line description
("Team Membership plugin for the Cisco Webex JS SDK."), install commands, a pointer to the developer
portal and API docs, and a Usage block. No other intent, design, or AI-authored spec exists in this
package.

The README covers little, repeats itself, and its one example does not run:

| README content | Code |
| -------------- | ---- |
| The Install and Usage sections each appear twice | — |
| Usage calls `webex.team-memberships.get(id)` and names the arrow parameter `team-membership` | The plugin is registered as `teamMemberships` (`src/index.js`). The hyphenated member reads as a subtraction, and a hyphenated parameter name is a syntax error, so the block is not valid JavaScript |
| Nothing about `create`, `list`, `update`, or `remove` | All five methods are in `src/team-memberships.js` |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Fixing or filling it in is a product-doc change, not a requirement
of making the package SDD-ready, and the other onboarded packages in this workspace kept their READMEs
the same way. It makes no behavioral claim the code does not already settle: its only example names a
method, `get`, that the module specification describes from code, so nothing is lost by not migrating
it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | It holds no behavior the specification lacks; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would only carry a broken example; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not copy the README example; the plugin is `webex.teamMemberships`.
- The repeated sections and the broken example remain until a maintainer makes a separate product-doc
  change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may fix the Usage example to `webex.teamMemberships.get(id)`, remove the repeated
  sections, and add examples for the other methods in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to document the five methods.

## References

- `README.md`
- `src/index.js`
- `src/team-memberships.js`
- `.sdd/manifest.json` `spec_source_policy`
