---
type: ADR
title: ADR-0001 - Retain the product README
description: Stage 0 keeps README.md as product documentation and does not route it as a spec source.
tags: [adr]
timestamp: 2026-10-07T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T07:23:05Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-10-07 |
| Deciders      | akulakum@cisco.com (bootstrap questionnaire, SPARK-853121) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Stage 0 found one existing document, `README.md`. It is the npm usage page. It shows installation,
`registerAndConnect` for the default session and named sessions, the `:<sessionId>` event suffix,
token get and set, `setRefreshHandler`, `refreshDataChannelToken`, the per-session accessors,
`getAllConnections`, `disconnectLLM`, and `disconnectAllLLM`.

The implementation in `src/` also has the owner-meeting checks, `clearDatachannelToken`,
`getWebSocketUrl`, the data-channel URL lookups, the `RegisterAndConnectTiming` result and
`error.timing`, the JWT feature toggle, the `subscriptionAwareSubchannels` query, and the `config.llm`
defaults. The README does not describe them. Its usage block also suggests importing
`DataChannelTokenType` from a source path, while `src/index.ts` exports it from the package root. No
other intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. The calls it shows exist in `src/llm.ts` with matching argument order, so
routing it as a spec source would add little beyond what the code already establishes.

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

- Agents must not treat `README.md` as the full list of methods, config keys, or ownership rules.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] None required for Stage 0.

## Revisit when

- A maintainer chooses to document ownership checks, timing results, or config defaults on the npm
  page.

## References

- `README.md`
- `src/index.ts`
- `src/llm.ts`
- `.sdd/manifest.json` `spec_source_policy`
