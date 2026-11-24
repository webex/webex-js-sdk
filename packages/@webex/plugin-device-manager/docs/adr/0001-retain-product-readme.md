---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-13T02:25:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T03:13:49Z
validation_status: pass
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-13 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found one existing document, `README.md`. It is the npm page: a one-line description
("Plugin for the DeviceManager service"), a warning that the plugin is under active development and
that breaking changes will happen, an install command, a pointer to the developer portal and API docs,
a samples command, a connect snippet, and a "Typical flow" list of methods. No other intent, design,
or AI-authored spec exists in this package. The `sample/` page and the package-root `webex.js` are
code, not documents.

The README's examples do not run as written:

| README content | Code |
| -------------- | ---- |
| The README's samples command, `samples:devicemanager` | The workspace `package.json` defines no such script, and `sample/index.html` loads a `../webex.min.js` that nothing builds |
| The connect snippet reads `webex` in `if (!webex)` without declaring it | Reading an undeclared variable throws a `ReferenceError` |
| "Typical flow" chains `getAll().refresh().search()…` | `getAll` returns an array, so `.refresh` is undefined on it; every other method returns a promise (`src/device-manager.js`) |
| The list names twelve methods | `src/device-manager.js` also has `get`, `upsert`, `remove`, `getAudioState`, `putAudioState`, `setVolume`, `getPairedDevice`, `getPairedMethod`, and `setPairedMethod` |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page. Fixing or filling it in is a product-doc change, not a requirement
of making the package SDD-ready, and the other onboarded packages in this workspace kept their READMEs
the same way. It makes no behavioral claim the code does not already settle: every method it lists is described
from code in the module specification, and its stability warning is carried into the module specification's Export stability section, so nothing is
lost by not migrating it.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | It holds no behavior the specification lacks; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would only carry examples that do not run; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not copy the README's chained flow or samples command.
- The broken examples remain until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may replace the chained flow with awaited calls, declare `webex` in the connect
  snippet, remove or wire up the samples command, and list the other methods in a separate
  product-doc change.

## Revisit when

- A maintainer rewrites the README or wires the `sample/` page into the workspace samples.

## References

- `README.md`
- `src/index.js`
- `src/device-manager.js`
- `sample/index.html`
- `.sdd/manifest.json` `spec_source_policy`
