---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-11-03T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-03T06:25:15Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-03 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found one existing document, `README.md`, the npm page for the package. Unlike a bare
usage stub, it carries behavioral claims: a feature table, usage examples, an events table, a method
and property reference, a security-controls table, and error-handling notes. No other intent, design,
or AI-authored spec exists in this package.

Checking those claims against `src/` and `test/` found these differences, where code is the referee:

| README claim | Code and test behavior | Evidence |
| ------------ | ---------------------- | -------- |
| "OAuth errors returned during redirect raise mapped `grantErrors`" | `initialize` throws, but the unit test pins a `TypeError` "Cannot convert object to primitive value" instead of a grant-error instance | `src/authorization.js`, `test/unit/spec/authorization.js` |
| Device flow handles `slow_down` by "exponential interval adjustment" | Only the next poll waits twice the base interval; the check reads `body.message` | `src/authorization.js`, `test/unit/spec/authorization.js` |
| `pollingCanceled` on "explicit cancel or internal timeout cleanup" | Also fires after `authorizationSuccess` and before a terminal `authorizationFailure`; does not fire on timeout | `src/authorization.js`, `test/unit/spec/authorization.js` |
| Method table lists five methods | Code also exposes `initiateThirdPartyLogin`, `initiateThirdPartyLoginRedirect`, `handleThirdPartyCallback`, and `logout` | `src/authorization.js` |
| Events table lists only `qRCodeLogin` event types | `Events.login` also emits `initiateLogin` and `redirectToLoginUrl` | `src/authorization.js`, `test/unit/spec/authorization.js` |
| The first usage example passes `client_secret` without `clientType` | `clientType` defaults to `public`, so that configuration uses form client authentication, not HTTP Basic | `src/config.js` |
| "Public-client device authorization ... not changed" | Device requests always send HTTP Basic with `client_secret`, whatever `clientType` is | `src/authorization.js` |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an empty
`spec_sources` list.

The canonical behavior is `src/` plus `test/`, described in `src/docs/README.md`. Where the README is
silent or disagrees, code wins, and the differences above are recorded in the module specification's
Pitfalls and constraints.

## Why

The README is the npm-facing page and the developer chose to keep it separate from the SDD tree.
Rewriting it is a product-doc change, not a requirement of making the package SDD-ready.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Reconcile the README into `src/docs/README.md`, marking stale claims | Not selected by the developer; the module spec is written from code and lists the differences instead |
| Migrate the README into the module spec as source text | Several claims are stale, and the README stays the npm page |
| Correct the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the method, event, or error reference.
- The stale claims stay until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] Optional product-doc change: align the README with the differences listed above.

## Revisit when

- A maintainer chooses to make the README match the code, or to make the module spec the published
  reference.

## References

- `README.md`
- `src/index.js`
- `src/authorization.js`
- `src/config.js`
- `.sdd/manifest.json` `spec_source_policy`
