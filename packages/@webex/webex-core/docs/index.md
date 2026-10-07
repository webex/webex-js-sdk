---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-07T13:20:21Z
validation_status: pass-with-warnings
-->

# @webex/webex-core documentation

Doc map for developers and agents working on the core library of the Webex JS SDK: the plugin host,
request interceptor pipeline, credentials, service discovery and storage layer.

## Start here

- [Getting started](getting-started.md) — prerequisites, build, and the test router
- [Repository architecture](architecture.md) — package boundaries, flows, dependencies and the contract index

There is no service specification and no API specification: the package is a published library with no
deployable runtime and no HTTP surface of its own. Both omissions are recorded in `.sdd/manifest.json`
under `layout.artifact_decisions`.

## Decisions

- [adr/](adr/) — architectural decision records. None are registered yet; the design trade-offs that
  shape the current code are recorded in each module specification's trade-off section.

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and the contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the root module: plugin host, public export surface, config
- [`src/interceptors/docs/README.md`](../src/interceptors/docs/README.md) — request/response interceptors
- [`src/lib/credentials/docs/README.md`](../src/lib/credentials/docs/README.md) — OAuth tokens and credentials
- [`src/lib/services/docs/README.md`](../src/lib/services/docs/README.md) — v1 service discovery
- [`src/lib/services-v2/docs/README.md`](../src/lib/services-v2/docs/README.md) — opt-in v2 service discovery
- [`src/lib/storage/docs/README.md`](../src/lib/storage/docs/README.md) — persistence layer
- [adr/](adr/) — concrete architectural decisions; the blank ADR template stays under `.sdd/`

The package's published contracts are npm package exports whose native source is the entry point
declared by `main` and `devMain` in [`package.json`](../package.json) and the barrel
[`src/index.js`](../src/index.js). The architecture page indexes them; the module specifications detail
them; neither copies declarations into Markdown.

## Related repository resources

- [`README.md`](../README.md) — the package's npm-facing readme (install and basic usage). Its storage
  example is stale relative to the code; see the storage module specification.
- [`src/lib/services-v2/README.md`](../src/lib/services-v2/README.md) — a work-in-progress note kept as-is
- Contribution guidelines, changelog generation and the release pipeline are owned at the Webex JS SDK
  workspace root
