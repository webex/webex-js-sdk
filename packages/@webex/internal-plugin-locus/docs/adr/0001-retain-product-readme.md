---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-09T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T06:22:13Z
validation_status: pending
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-09 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853128) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It names the package as
the plugin for the Locus service, warns that internal plugins do not strictly follow semantic
versioning, shows the install command, and shows a usage block that imports the package and
`@webex/webex-core` and then reads `webex.internal.locus.WHATEVER`.

The implementation in `src/` has eighteen plugin methods (two marked private in JSDoc), seven
exported constants, the
`eventKeys` list, the sequence comparison algorithm, delta merge, and the Conflict recovery. The
README describes none of them, and its usage line is a placeholder rather than a real API. No other
intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. What it does state (the package name, internal status, install, and import)
agrees with `package.json` and `src/index.js`, and it states no behavior that could conflict with
the module specification.

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

- Agents must not treat `README.md` usage text as the method list.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required for Stage 0.

## Revisit when

- A maintainer chooses to document real methods on the npm page.

## References

- `README.md`
- `src/index.js`
- `src/locus.js`
- `.sdd/manifest.json` `spec_source_policy`
