---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-03T20:17:51Z
validation_status: not-run
-->

# @webex/storage-adapter-local-storage documentation

Doc map for developers and agents working on the browser localStorage bounded storage adapter.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)

There is no service specification — this package is a published library, not a deployable service.
There is no API specification — the package exposes no HTTP surface; its published contract is the
npm ES module export declared in `package.json`.

## Decisions

No architectural decision records exist for this package yet. When one is needed, add it as a
concrete file under `docs/adr/`; the blank ADR template stays under
`.sdd/templates/repo-standards/`.

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture, including the contract
  index and the security posture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`../src/docs/README.md`](../src/docs/README.md) — the owning specification beside the module's
  code; authoritative for adapter behavior

Use the manifest-linked native source for exact contract details. For this package that is
`package.json`, the ecosystem-native declaration of the published SDK surface; the package ships no
`.d.ts` and no API report. Register and link those sources from the architecture index and the
owning module spec instead of copying them into Markdown.

## Related repository resources

- `../README.md` — the npm-facing package reference. Registered as **reference-only** under a
  `keep-separate` source policy and **not authoritative**; it describes `clear()` as
  namespace-scoped, which the code contradicts. Use the module spec for behavior.
- `../AGENTS.md` — agent instructions for this package.
- `../.sdd/manifest.json` — the SDD manifest: modules, contracts, layout, and coverage state.
- The repository root carries its own `AGENTS.md`, `CONTRIBUTING.md`, and CI workflows that govern
  this package alongside the rest of the monorepo.
