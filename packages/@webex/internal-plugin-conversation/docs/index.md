---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-16T01:43:45Z
validation_status: pass
-->

# @webex/internal-plugin-conversation documentation

Doc map for developers and agents working on the Plugin for the Conversation service:
`webex.internal.conversation`, which creates, reads, and updates Webex conversations and their
activities with transparent KMS encryption.

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning.
Use at your own risk. If you're not working on one of our first party clients, please look at our
developer api and stick to our public plugins.

## Start here

- [Getting started](getting-started.md) — prerequisites, build, configuration, and the test router
- [Repository architecture](architecture.md) — boundaries, dependencies, and the contract index
- No service specification: this package is a library, not a deployable service
- No OpenAPI document: the package owns no HTTP API

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [src/docs/README.md](../src/docs/README.md) — the owning specification beside the module's code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  repository-root `.sdd/` snapshot

Use the manifest-linked native source for exact contract details. This package publishes an SDK
surface whose native sources are `package.json` and the files under `src/`; register and link those
sources from the architecture index and the module spec instead of copying them into Markdown.

## Related repository resources

- [Package README](../README.md) — the npm-facing readme
- The repository-root `AGENTS.md` and `CONTRIBUTING.md` own monorepo-wide workflow.
