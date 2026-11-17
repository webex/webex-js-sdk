---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T10:05:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T10:21:50Z
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

Onboarding found one existing document, `README.md`. It is the npm usage page: an install command,
register and unregister examples, and examples of `lookupDetail`, `lookup`, `lookupByEmail`, and
`search`. No other intent, design, or AI-authored spec exists in this package.

Several of its claims no longer match the code:

| README claim | Code |
| ------------ | ---- |
| `lookup({ids: [...]})` looks up several identities in one call | `lookup` takes one `id` (`LookupOptions` in `src/types.ts`) and resolves one entity or `null`; several ids are combined only by the batcher (`src/dss.ts`) |
| `lookupByEmail({emails: [...]})` looks up several emails | `lookupByEmail` takes one `email` (`LookupByEmailOptions`) and resolves one entity or `null` (`src/dss.ts`) |
| `register()` and `unregister()` connect to and disconnect from mercury | `register` connects; `unregister` only removes the two mercury listeners and resets `registered` (`src/dss.ts`) |
| `search` is called with a bare `PERSON` value | No `PERSON` binding is exported; `src/index.ts` exports only the default `DSS`, and the values are the strings in `SearchType` (`src/types.ts`) |
| The methods listed | It omits `lookupByPhoneNumbers`, `searchPlaces`, the `shouldBatch` option of `lookup`, the `search` device flags, and the `dss:*` events (`src/dss.ts`, `src/constants.ts`) |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. Where the README differs from code, code wins and the
module specification follows code.

## Why

The README is the npm-facing page. Correcting it is a product-doc change, not a requirement of making
the package SDD-ready, and the other onboarded packages in this workspace kept their READMEs the same
way. The module specification records the current method signatures, resources, events, and result
shapes, so nothing in the README needs to be preserved by migration.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | Several call signatures in it are stale, so migrating them would carry wrong content; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would preserve stale wording in the canonical spec; the developer chose `keep-separate` |
| Correct the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the reference for method signatures or the `unregister`
  behavior.
- The stale README remains until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may correct the README `lookup` and `lookupByEmail` signatures, the `unregister`
  description, and add the missing methods in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to match the single-value `lookup` and `lookupByEmail` options and
  documents `lookupByPhoneNumbers` and `searchPlaces`.

## References

- `README.md`
- `src/index.ts`
- `src/dss.ts`
- `src/constants.ts`
- `src/types.ts`
- `.sdd/manifest.json` `spec_source_policy`
