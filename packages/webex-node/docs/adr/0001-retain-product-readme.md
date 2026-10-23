---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-15T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T23:00:24Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-15 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853131) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It links an upgrade
guide, shows the install commands, shows a usage example that creates an instance with
`init({credentials: {access_token}})` and then calls the rooms, memberships, and messages plugins,
and states that the package is not meant for browsers.

The implementation in `src/` has the polyfill guard, the 17-package plugin load list, the
`WebexNode` class with `init`, and the configuration object. The README describes none of the
configuration or the plugin set, and its usage example relies on plugins whose APIs other packages
own. No other intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. What it states about this package (the name, the install, `init` with
credentials, and Node.js only) agrees with `package.json` and `src/`, and it states no behavior of
this package that conflicts with the module specification.

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

- Agents must not treat the README usage example as the API of this package; the plugin calls it
  shows belong to other packages.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required for Stage 0.

## Revisit when

- A maintainer chooses to document the package configuration or plugin set on the npm page.

## References

- `README.md`
- `src/index.js`
- `src/webex-node.js`
- `.sdd/manifest.json` `spec_source_policy`
