---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-11-13T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T13:41:05Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-13 |
| Deciders      | rarajes2@cisco.com (confirmed in chat, after the generator proposed it from the keep-separate precedent on the sibling packages in the root `.sdd/manifest.json`) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm page: development, build, test, and
sample commands, the install commands, an import line, and a single-organization example that
constructs `BYODS`, stores a refresh token, and lists data sources. It also states that the default
adapter holds one token pair in memory and what a custom `TokenStorageAdapter` must implement.

The implementation in `src/` covers the token lifecycle, the data source client, JWS renewal and
verification, and logging. What the README states agrees with the code. It does not describe JWS
renewal failure handling, the default nonce generator, the shared logger, or the `main` entry field
that no build script produces (module spec `MOD-016`, `MOD-017`, `MOD-019`, `MOD-020`). No other
intent, design, or AI-authored spec exists in this package, and no older Repo Annotation footprint
was found.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready, and it contradicts no behavior in the module specification. The same choice
was made for every sibling package listed in the root `.sdd/manifest.json`.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | The page is published product documentation, and deletion was not requested |
| Expand the README during Stage 0 | Stage 0 writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Readers of the npm page do not learn about the renewal and entry-field behaviors until the README
  is updated separately.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [x] Decision confirmed by rarajes2@cisco.com on 2026-11-13.

## Revisit when

- A maintainer documents renewal failure handling or the entry fields on the npm page.

## References

- `README.md`
- `src/index.ts`
- `src/docs/README.md`
- `.sdd/manifest.json` `spec_source_policy`
