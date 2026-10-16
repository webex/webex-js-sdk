---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-12T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T11:06:00Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-12 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853128) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It describes the package
as a plugin for scheduler management, warns that internal plugins do not strictly follow semantic
versioning, shows the install command, and shows a usage block that imports the package and
`@webex/webex-core` and reads `webex.internal.scheduler`. Its maintainer line is an unfilled
placeholder.

The usage block matches `src/index.js`. The README names no method, because the plugin has only
example methods, and it does not say that the code is a scaffold or that importing the package
registers payload transforms. No other intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. Its usage block agrees with `src/index.js`, and the module specification
records what it leaves out.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | The page is retained product documentation, and deletion was not requested |
| Expand the README during Stage 0 | Stage 0 writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Readers of the npm page are not told that the package is a scaffold.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- None.

## Revisit when

- Scheduler behavior is implemented and the npm page needs to describe it.

## References

- `README.md`
- `src/index.js`
- `src/scheduler/scheduler.js`
- `.sdd/manifest.json` `spec_source_policy`
