---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T11:32:37Z
validation_status: pass-with-warnings
-->

# @webex/storage-adapter-local-forage documentation

Doc map for developers and agents working on the browser storage adapter that persists Webex JS SDK
data in IndexedDB through `localforage`.

## Start here

- [Getting started](getting-started.md) — prerequisites, build, lint, and the current state of the
  tests
- [Repository architecture](architecture.md) — what the package publishes, where its data lives, and
  its host, release, and security boundaries

There is no service specification and no API specification for this package. It is a published
library with no deployable runtime and no HTTP surface, and both omissions are recorded in
`.sdd/manifest.json` under `layout.artifact_decisions`.

## Decisions

- [adr/](adr/index.md) — architectural decision records. None are registered yet; the design
  choices behind the current behavior are recorded in the module specification's
  `Key design trade-off` section.

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and the contract index
- [specs/README.md](specs/README.md) — module and specification registry
- [`src/docs/README.md`](../src/docs/README.md) — the owning specification beside the module's code:
  public surface, requirements, data layout, failure modes, hazards, and verification gaps
- [adr/](adr/index.md) — concrete architectural decisions; the blank ADR template stays hidden in
  the shared template snapshot

The package publishes two contracts. `local-forage-storage-adapter` is the npm package surface; its
native source is the entry point declared by `main` and `devMain` in [`package.json`](../package.json),
with the exact declarations in [`src/index.js`](../src/index.js). `local-forage-indexeddb-store` is the
on-device record layout defined in the same file. The architecture page indexes both contracts and
the module specification details them; neither copies the declarations into Markdown.

## Related repository resources

- [`README.md`](../README.md) — the package's npm-facing readme (install and pointer to the SDK
  documentation)
- Contribution guidelines, changelog generation, and the release pipeline are owned at the Webex JS
  SDK workspace root, not in this package
