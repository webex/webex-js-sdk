---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T14:00:00Z
validation_status: not-run
-->

# @webex/contact-center documentation

Doc map for developers and agents working on the Contact Center SDK plugin (`webex.cc`). The package
overview, technologies, and runtime composition are in the [package architecture](architecture.md).

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

Start with the package [`AGENTS.md`](../AGENTS.md) for critical repository rules and the developer workflow, then use the [specification registry](specs/README.md) to classify the task by owning module and open its module specification.

This package is a library, so there is no service specification and no OpenAPI document.

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and the contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `docs/README.md` inside each module directory — each manifest-routed module has one canonical
  module specification beside its code, listed in the [Module registry](specs/README.md#module-registry);
  the retained module-level `src/utils/AGENTS.md` guide is a reference-only migration source, as recorded in
  [ADR-0003](adr/0003-repo-standards-migration.md)
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

Exact contract details live in the native sources linked from the architecture contract index:
`package.json` for the published entry points, `src/index.ts` for the exports, and the TypeScript type
files named there for the events and payloads. To change behavior, follow the Working Method in
[`AGENTS.md`](../AGENTS.md); update the package `AGENTS.md` when task routing or critical rules change, and do not update the retained `src/utils/AGENTS.md` as an independent source of truth.

## Related repository resources

- [`README.md`](../README.md) — npm package page
- [`typedoc.md`](../typedoc.md) — landing page of the generated API reference (`yarn build:docs`)
- [`src/utils/AGENTS.md`](../src/utils/AGENTS.md) — retained Utils guide; reference-only
- The Contact Center sample app is in the workspace `docs/samples/contact-center` folder; the
  end-to-end suite in the workspace `cc_playwright` folder drives it.
