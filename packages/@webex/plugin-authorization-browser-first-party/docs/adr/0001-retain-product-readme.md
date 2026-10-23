---
type: ADR
title: ADR-0001 - Retain the product README and treat code as the behavioral authority
description: The hand-written package README stays untouched as the npm guide while SDD specs are generated from code and tests.
tags: [adr]
timestamp: 2026-10-14T13:20:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-14T13:20:00Z
validation_status: not-run
-->

# ADR-0001 - Retain the product README and treat code as the behavioral authority

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-14 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

The package already had a hand-written `README.md` with install steps, usage examples, an events
table, an API reference, security considerations, and error handling notes. It is the page npm
consumers read. SDD onboarding needed a decision on whether that file is migrated into the canonical
specs, reconciled with them, or kept separate. Several README statements differ from current code:
`Events` is read from the instance in an example although it is only a module export; the QR event
table says `pollingCanceled` is emitted on internal timeout, while the timeout emits only
`authorizationFailure`; and `slow_down` handling is described as exponential while the code doubles one
delay. The divergences are listed in the module specification's Pitfalls and constraints section.

## Decision

Keep `README.md` byte-for-byte unchanged as the npm-facing guide. Generate the canonical
specifications (`docs/` and `src/docs/README.md`) from source and tests. Record the README in
`.sdd/manifest.json` `spec_sources` as `reference-only`, `canonical: false`, `use_by_agents:
context-only`.

## Why

The README serves a different audience (npm consumers) than the SDD specs (maintainers and agents),
and it contains statements that do not match code. Migrating it would either import stale statements
into canonical specs or require rewriting a consumer-facing page during a documentation-only
onboarding. Code and tests answer every behavioral question the specs need.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into canonical specs | Would carry its stale event-order and API statements into the authoritative documents |
| Reconcile README and code | Would block onboarding on correcting a consumer-facing page that is outside this documentation-only change |

## Consequences

**Positive:**

- The npm page is unchanged; no consumer-visible documentation churn.
- Canonical specs describe only verified behavior.

**Negative / tradeoffs:**

- Two documents describe the same API; the README can drift further. The module spec lists the
  known divergences so maintainers can correct the README separately.

## Constraint on future changes

When behavior changes, update `src/docs/README.md` in the same change. Do not cite `README.md` as
evidence for behavior in canonical specs.

## Follow-up

- [ ] Correct the README divergences listed in the module specification, in a separate change
- [ ] Re-evaluate this decision if the README is rewritten from the specs

## Revisit when

- The team decides to generate the npm README from the canonical specs, or the README divergences are
  corrected and a single source is preferred.

## References

- Module specification: [src/docs/README.md](../../src/docs/README.md)
- Manifest routing: `.sdd/manifest.json`
