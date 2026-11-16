---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md and assets/README.md as product documentation and routes them only as context.
tags: [adr]
timestamp: 2026-11-16T05:39:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T05:59:53Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-16 |
| Deciders      | rarajes2@cisco.com (chosen in chat during onboarding) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found two existing documents. `README.md` is the npm page: a one-line description
("Plugin for the Encryption and KMS services"), a warning that the plugin is internal and does not
strictly follow semantic versioning, install and usage snippets, and a long "KMS certificate
validation" guide. The guide covers the configuration fields, the enforced and report-only behavior
table, asset verification and caching, the four metrics, hosting the assets, offline roots generated
with `@webex/kms-caroots`, and refreshing the shipped bundle. `assets/README.md` is a maintainer note
on the shipped Union bundle. No other intent, design, or AI-authored spec exists in this package.

Checked against code at onboarding:

| Document content | Code |
| ---------------- | ---- |
| Usage reads `webex.internal.encryption.WHATEVER` | A placeholder; the real methods are listed in the module specification's Public surface |
| Certificate validation defaults, precedence of `caroots`, `carootsReportOnly`, and `reportOnlyAssetsBaseUrl`, the behavior table, caching by source, and the metric names | Agree with `src/config.js`, `src/kms.js`, `src/constants.js`, and the CA-roots loaders |
| `assets/README.md`: the SDK downloads the bundle on first KMS use | In Node, `src/caroots-asset.js` reads the packaged copy first and downloads only when it is missing |
| `assets/README.md`: the workspace root build:script copies the assets to the `webex` UMD folder | The workspace build owns that copy; this package's `build:assets` copies only to `dist/assets` |

## Decision

Keep `README.md` and `assets/README.md` unchanged. Do not migrate them into the module
specification. Record `spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition`
`retain`, and route both in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page, and its certificate-validation guide is written for application
developers; it is accurate today. The module specification restates that behavior from code with
requirement IDs (MOD-023 to MOD-027), so nothing is lost by leaving the guide where its readers look.
The developer chose `keep-separate` in chat, the same choice as the other onboarded packages in this
workspace.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the guide into `src/docs/README.md` and delete it | The npm page would lose its user documentation; deletion was not requested |
| Reconcile the README with the module specification | It would copy application-facing wording into the specification for no behavioral gain; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit product documents |

## Consequences

**Positive:**

- The npm page and the asset note stay stable.
- The module specification is the single behavioral reference for agents.

**Negative / tradeoffs:**

- Two descriptions of certificate validation exist and can drift; a change to that behavior must
  update both.
- The placeholder usage line and the asset note's first-use wording remain until a maintainer edits
  them.

## Constraint on future changes

Do not delete either document as part of spec maintenance. When certificate-validation behavior
changes, update the module specification from code and check the README guide in the same change.

## Follow-up

- [ ] A maintainer may replace the `WHATEVER` usage line and say in `assets/README.md` that Node reads
  the packaged copy first, in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README, or the certificate-validation guide moves elsewhere.

## References

- `README.md`
- `assets/README.md`
- `src/config.js`
- `src/kms.js`
- `src/caroots-asset.js`
- `.sdd/manifest.json` `spec_source_policy`
