---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-13T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T15:50:41Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-13 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853131) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It shows the install
command, a Node example that calls `Webex.init` with an access token and uses `rooms`,
`memberships`, and `messages`, the UMD script tags with global `Webex`, a bundler example that
imports `init` from the package, and links for `webex/env`, the API docs site, and contributing.

The implementation in `src/` also has the meetings, calling, encryption, and first-party entry
files, the storage adapter choice, and the package config. The README describes none of them. No
other intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/`, the package-root helpers, `package.json`, and `test/`. Where the
README is incomplete or differs, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. Its examples use surfaces that exist in code (`Webex.init`, the plugin
namespaces, the UMD global `Webex`), so they do not conflict with the module specification.

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

- Agents must not treat `README.md` as the list of entry points.
- The README's `webex/env` link and its window global wording differ from the `exports` map and
  `browser.js`; those differences are recorded in the module spec Pitfalls, not fixed here.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required for Stage 0.

## Revisit when

- A maintainer chooses to document the meetings, calling, or encryption entries on the npm page.

## References

- `README.md`
- `package.json`
- `src/webex.js`
- `.sdd/manifest.json` `spec_source_policy`
