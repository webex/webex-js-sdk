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
updated_at: 2026-10-09T16:00:49Z
validation_status: pass-with-warnings
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
the plugin for the Task service, warns that internal plugins do not strictly follow semantic
versioning, shows the install command, and shows a usage block that imports the package and
`@webex/webex-core` and then calls `listMyTasks`, `getTask`, `createTask`, `updateTask`,
`deleteTask`, `acceptTask`, and `rejectTask`.

Those seven names match `src/task.js`. The README does not describe `register`, `unregister`, the
two plugin events, the encryption of `title` and `notes`, or the fact that each REST method resolves
the whole response rather than a task object, which the README's callback parameter name `task`
suggests. No other
intent, design, or AI-authored spec exists in this package.

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain` and an
empty `spec_sources` list.

The canonical behavior is `src/` plus `test/`. Where the README is incomplete, code wins.

## Why

The README is the npm-facing page. Rewriting it is a product-doc change, not a requirement of making
the package SDD-ready. Its method list agrees with `src/task.js`, and the module specification
records the behavior it leaves out.

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

- Agents must not infer return shapes from the README callback names.
- README improvements remain a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- None.

## Revisit when

- A maintainer chooses to document registration, encryption, or return shapes on the npm page.

## References

- `README.md`
- `src/index.js`
- `src/task.js`
- `.sdd/manifest.json` `spec_source_policy`
