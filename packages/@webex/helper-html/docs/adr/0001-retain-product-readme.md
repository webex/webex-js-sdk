---
type: ADR
title: Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr, spec-source-policy]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: cursor
approved_by: repository user
updated_at: 2026-10-01T11:15:00Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

## Context

Stage 0 found one existing document, `README.md`. It is a product usage page. It describes `filter` as `filter(allowedTags, allowedStyles, html)`. The implementation in `src/html.js` and `src/html.shim.js` curries with arity 4 and takes `processCallback` first. The unit spec in `test/unit/spec/html.js` calls the functions that way.

No other intent spec, design spec, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into `src/docs/README.md`. Record `spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an empty `spec_sources` list.

The canonical behavior is `src/` plus `test/unit/spec/html.js`. Where the product README disagrees, code wins. That disagreement is not a defect in the retained product page.

## Why

The README is the npm-facing usage page linked from the package description. Rewriting it is a product-doc change, not a requirement of making the package SDD-ready. Routing it as a spec source would copy a signature the code does not implement.

## Alternatives considered

- Migrate the README into the module spec and delete it. Rejected because the page is a retained product document, and deletion was not requested.
- Reconcile by editing the README signature during Stage 0. Rejected because Stage 0 retains the product README and this change set is documentation for the SDD tree.

## Consequences

- Agents must not treat `README.md` as the API contract.
- Future API corrections to the README are a separate product-doc change.
- `src/docs/README.md` is the protected canonical spec.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage examples are corrected, keep the correction in that file and leave the module spec aligned with code.

## Follow-up

None required for Stage 0.

## Revisit when

A maintainer chooses to update the npm usage page so its signature matches `src/html.shim.js`.

## References

- `README.md`
- `src/index.js`
- `src/html.shim.js`
- `test/unit/spec/html.js`
- `.sdd/manifest.json` `spec_source_policy`
