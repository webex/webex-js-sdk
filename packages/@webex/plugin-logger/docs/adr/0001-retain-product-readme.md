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
updated_at: 2026-10-08T08:51:39Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-06 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is a product usage page. It lists the levels `silent`, `error`, `warn`, `log`, `info`, `debug`, and `trace`, names `error` as the default, and shows `WEBEX_LOG_LEVEL` as the control.

The implementation in `src/logger.js` also exposes `group` and `groupEnd`, `client_` variants of every level, `logToBuffer`, buffers, `formatLogs`, and seven `config.logger` keys. The README does not describe them. `silent` is a precedence value in `src/logger.js` but is not part of the exported `levels` array.

No other intent spec, design spec, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into `src/docs/README.md`. Record `spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an empty `spec_sources` list.

The canonical behavior is `src/` plus `test/unit/spec/logger.js`. Where the product README is incomplete, code wins. That gap is not a defect in the retained product page.

## Why

The README is the npm-facing usage page. Rewriting it is a product-doc change, not a requirement of making the package SDD-ready. Its statements that are present agree with the code, so routing it as a spec source would add little.

## Alternatives considered

- Migrate the README into the module spec and delete it. Rejected because the page is a retained product document, and deletion was not requested.
- Expand the README during Stage 0. Rejected because Stage 0 is documentation for the SDD tree and does not edit `README.md`.

## Consequences

- Agents must not treat `README.md` as the full list of levels, methods, or config keys.
- Future README improvements are a separate product-doc change.
- `src/docs/README.md` is the protected canonical spec.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text is extended, keep the change in that file and leave the module spec aligned with code.

## Follow-up

None required for Stage 0.

## Revisit when

A maintainer chooses to document client logging, buffers, or upload formatting on the npm usage page.

## References

- `README.md`
- `src/index.js`
- `src/logger.js`
- `src/config.js`
- `test/unit/spec/logger.js`
- `.sdd/manifest.json` `spec_source_policy`
