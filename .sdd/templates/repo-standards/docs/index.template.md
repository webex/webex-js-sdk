---
okf_version: '0.1'
---
<!-- ───────────────────────────────
  Template:     Documentation Home
  Template-ID:  docs-index
  Generates:    docs/index.md
  Description:  Resolved from WebexTools/repo-standards templates/docs/index.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/docs/index.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# [Repository name] documentation

Doc map for developers and agents. This template includes `okf_version` by
default; remove the frontmatter block if your team is not using OKF
frontmatter on docs pages.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- [Service specification](service.md) — only for a deployable service
- [API specification](../api-specs/openapi.yaml) — only when applicable;
  adjust path if different

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- [service.md](service.md) — one deployable service's runtime and operating
  contract, when applicable
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `<module-path>/docs/README.md` — the owning specification beside each module's code
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details: OpenAPI for published repository
HTTP APIs, route code for internal HTTP surfaces, and ecosystem-native artifacts for published SDKs.
Register and link those sources from the architecture index and owning module spec instead of copying
them into Markdown.

## Related repository resources

Link existing `ci/`, `operate/`, `diagrams/`, runbook, or other repository-owned documentation here
when it exists. Do not create placeholder folders or a second contract-document family.
