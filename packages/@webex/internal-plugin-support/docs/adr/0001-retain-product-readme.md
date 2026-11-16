---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T11:54:25Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T12:27:40Z
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
("Plugin for Support-related endpoints"), an internal-plugin notice, an install command, and a Usage
block. No other intent, design, or AI-authored spec exists in this package.

The README documents no behavior that the code has:

| README content | Code |
| -------------- | ---- |
| Usage ends with the placeholder member `webex.internal.support.WHATEVER` | The plugin exposes `getFeedbackUrl`, `getSupportUrl`, and `submitLogs` (`src/support.js`) |
| No method, option, or result is described | `submitLogs` takes metadata, optional logs, and a `type` of `full` or `diff`, and resolves the upload result (`src/support.js`) |
| Nothing about configuration | Importing the package sets `config.support` defaults and pre-discovery service URLs (`src/config.js`) |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Filling it in is a product-doc change, not a requirement of making
the package SDD-ready, and the other onboarded packages in this workspace kept their READMEs the same
way. It holds no behavioral claim to preserve, so nothing is lost by not migrating it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | It carries no behavior to migrate; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would only preserve placeholder wording; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as a usage reference; its Usage block names a member that does not
  exist.
- The placeholder README remains until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may replace the README Usage placeholder with real `submitLogs` and desk URL
  examples in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to document `submitLogs`, `getFeedbackUrl`, and `getSupportUrl`.

## References

- `README.md`
- `src/index.js`
- `src/config.js`
- `src/support.js`
- `.sdd/manifest.json` `spec_source_policy`
