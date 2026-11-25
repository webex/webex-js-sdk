---
type: ADR
title: ADR-0001 - Fork xhr to support fully object-frozen environments
description: The browser transport uses a vendored fork of naugtur/xhr, held close to upstream, because the published package does not work where the global object graph is frozen.
tags: [adr]
timestamp: 2026-09-23T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-23T06:29:48Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Fork `xhr` to support fully object-frozen environments

| Field         | Value                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Status        | Accepted                                                                |
| Decision date | Not recorded in the codebase                                            |
| Deciders      | Not recorded in the codebase                                            |
| Supersedes    | N/A                                                                     |
| Superseded by | N/A                                                                     |

## Context

The browser transport needs an `XMLHttpRequest` wrapper that presents the same option vocabulary as
the Node `request` library, so that one public API works on both platforms. The `naugtur/xhr`
package provides that wrapper.

Some environments the SDK must run in freeze the object graph completely. `src/lib/xhr.js` records
the problem directly in its header: the fork exists "to support environments with full object
freezing; namely, SalesForce's Aura and Locker environment." The upstream package does not function
under that constraint.

## Decision

Vendor a fork of `naugtur/xhr` into the repository at `src/lib/xhr.js`, and have the browser
transport import it from there rather than from `node_modules`. `src/request/request.shim.js`
imports `xhr` from `../lib/xhr`, so no browser request path reaches the upstream package.

The fork keeps upstream's code style deliberately. Its header states the rule: "Maintain the original
code style of https://github.com/naugtur/xhr since we're trying to diverge as little as possible."
The file carries a whole-file `/* eslint-disable */` so repository lint rules do not force it away
from that style, and it keeps upstream's `var` declarations and `'use strict'` prologue.

Its runtime dependencies are declared as ordinary dependencies of this package: `global`,
`is-function`, `parse-headers`, and `xtend` in `package.json` exist to serve this file.

## Why

A fork was required because the constraint is environmental, not stylistic — the package simply does
not run where the object graph is frozen, and no configuration of the published package avoids that.

Holding the fork close to upstream is the second half of the decision, and it is what makes the first
half sustainable: a fork that drifts cannot absorb upstream fixes, and this file implements the
error, timeout, abort, and header-parsing behavior every browser request in the SDK depends on.

## Alternatives considered

| Alternative                              | Why it was not selected                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Depend on the upstream `naugtur/xhr` package | It does not work in environments that fully freeze objects, which the SDK must support                     |
| Reformat the fork to repository style    | Rejected implicitly by the file's own instruction to diverge as little as possible, and by its `eslint-disable` |

No other alternatives are recorded in the codebase. Rationale beyond what the file states is not
reconstructed here.

## Consequences

**Positive:**

- Browser requests work in fully object-frozen environments.
- The browser transport keeps the same option vocabulary as the Node transport, so one public API
  serves both platforms.

**Negative / tradeoffs:**

- The repository owns third-party code it must maintain, including its security posture.
- Upstream fixes are not received automatically; they must be ported deliberately.
- The file is excluded from repository lint rules, so ordinary static analysis does not cover it.
- Four dependencies in `package.json` exist only to serve this one file.

## Constraint on future changes

Keep `src/lib/xhr.js` as close to its upstream original as the frozen-object requirement allows.
Do not reformat it, do not re-enable repository lint rules on it, and do not refactor it to
repository conventions. Port upstream changes as discrete, reviewable diffs.

Do not switch the browser transport to the upstream package or to another XHR wrapper without first
confirming the replacement works under full object freezing.

## Follow-up

- [ ] Record the upstream commit or version this fork is based on, so future ports have a baseline
- [ ] Confirm whether the frozen-object environments named in the file header are still supported targets

## Revisit when

- The named frozen-object environments are no longer supported targets.
- Upstream `naugtur/xhr`, or a maintained alternative, works under full object freezing.
- The browser transport moves off `XMLHttpRequest`, which would remove the dependency entirely.

## References

- `src/lib/xhr.js` — the fork and its stated rationale
- `src/request/request.shim.js` — the only importer
- `package.json` — the four dependencies that exist to serve the fork
