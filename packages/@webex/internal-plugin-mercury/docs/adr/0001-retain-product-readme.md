---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-06T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-06T23:49:26Z
validation_status: pending
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-06 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853121) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It shows installation,
multiple sessions with `connect`, `disconnect`, `disconnectAll`, and `getSocket`, the `:<sessionId>`
event suffix, a `defaultMercuryOptions.agent` proxy example, and the retry settings `maxRetries`,
`initialConnectionMaxRetries`, `backoffTimeMax`, and `backoffTimeReset`.

The implementation in `src/` also has the close-code reconnect policy, the shutdown switchover
events, autowired `process<Name>Event` handlers, feature-toggle URL rewriting, the
`JS_SDK_MERCURY_CLOSE_4000` metric, the `Socket` protocol, and config keys such as `pingInterval`,
`pongTimeout`, `forceCloseDelay`, and `beforeLogoutOptionsCloseReason`. The README does not describe
them, and its usage block shows a placeholder property rather than a real API. No other intent,
design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specifications. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. The statements it does make agree with `src/mercury.js`, with one nuance: it
gives `maxRetries` and `initialConnectionMaxRetries` a default of 0, while `src/config.js` sets no
default and the code treats any falsy value as unlimited retries. The observable result is the same,
so routing the README as a spec source would add little.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | The page is retained product documentation, and deletion was not requested |
| Expand the README during Stage 0 | Stage 0 writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specifications are the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the full list of config keys, events, or methods.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specifications aligned with code rather than with the README.

## Follow-up

- [ ] None required for Stage 0.

## Revisit when

- A maintainer chooses to document reconnect policy, shutdown events, or config defaults on the npm
  page.

## References

- `README.md`
- `src/index.js`
- `src/mercury.js`
- `src/config.js`
- `.sdd/manifest.json` `spec_source_policy`
