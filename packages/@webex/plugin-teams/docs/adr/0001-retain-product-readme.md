---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T17:26:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:50:28Z
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

Onboarding found one existing document, `README.md`. It is the npm page: a one-line description
("Teams plugin for the Cisco Webex JS SDK."), install commands, a pointer to the developer portal, and
a Usage block. No other intent, design, or AI-authored spec exists in this package.

The README is accurate where it speaks, but it covers little and repeats itself:

| README content | Code |
| -------------- | ---- |
| The Install and Usage sections each appear twice | — |
| Usage shows `webex.teams.get(id)` resolving a team | Matches `get` in `src/teams.js` |
| Nothing about `create`, `list`, or `update`, or about scopes | All four methods are in `src/teams.js`; no scope is named in the package |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Filling it in is a product-doc change, not a requirement of making
the package SDD-ready, and the other onboarded packages in this workspace kept their READMEs the same
way. Its one behavioral claim, the `get(id)` example, is already in the module specification, so
nothing is lost by not migrating it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | Its behavior is already specified; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would only carry one example; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as complete; it shows only `get(id)`.
- The repeated Install and Usage sections remain until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may remove the repeated sections and add examples for `create`, `list`, and
  `update` in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to document more than `get(id)`.

## References

- `README.md`
- `src/index.js`
- `src/teams.js`
- `.sdd/manifest.json` `spec_source_policy`
