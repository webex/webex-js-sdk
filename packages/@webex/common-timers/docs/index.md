---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-28T05:34:36Z
validation_status: pass
-->

# @webex/common-timers documentation

Doc map for developers and agents working on the timer primitives the Webex JS SDK schedules all of
its deferred work through.

## Start here

- [Getting started](getting-started.md) — prerequisites, build, and the test router
- [Repository architecture](architecture.md) — what the package publishes, what it depends on, and
  the platform and release boundaries it sits inside

There is no service specification and no API specification for this package: it is a published
library with no deployable runtime and no HTTP surface. Both omissions are recorded in
`.sdd/manifest.json` under `layout.artifact_decisions`.

## Decisions

- [adr/](adr/) — architectural decision records. None are registered yet; the decisions that shape
  the current design are recorded in the module specification's `Key design trade-off` section.

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and the contract index
- [specs/README.md](specs/README.md) — module and specification registry
- [`src/docs/README.md`](../src/docs/README.md) — the owning specification beside the module's code:
  public surface, requirements, state machine, failure modes, and verification
- [adr/](adr/) — concrete architectural decisions; the blank ADR template stays under `.sdd/`

The package's one contract, `common-timers-sdk`, is a published npm package surface. Its native
source is the entry point declared by `main` and `devMain` in [`package.json`](../package.json), and
the exact declarations live in [`src/index.ts`](../src/index.ts). The architecture page indexes that
contract and the module specification details it; neither copies the declarations into Markdown.

## Related repository resources

- [`README.md`](../README.md) — the package's npm-facing readme, covering install and basic usage
- Contribution guidelines, changelog generation, and the release pipeline are owned at the Webex JS
  SDK workspace root, not in this package
