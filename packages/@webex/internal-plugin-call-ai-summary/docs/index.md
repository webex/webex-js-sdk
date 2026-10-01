---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: "@riag"
updated_at: 2026-09-23T14:03:22Z
validation_status: pass
-->

# @webex/internal-plugin-call-ai-summary documentation

Internal Webex JS SDK plugin for retrieving AI-generated call summaries, notes, action items, and transcripts from completed calls.

This plugin resolves AI summary containers via the **Pragya** service and fetches encrypted summary content from URLs returned by Pragya. All content is decrypted through the Webex KMS encryption plugin before it reaches the caller.

**Discovery flow:**

1. **Janus** (call history) returns `extensionPayload.callingContainerIds` per call session
2. **Pragya** resolves a container ID into metadata including content URLs and encryption key
3. **Plugin** fetches content from those URLs and decrypts using `@webex/internal-plugin-encryption`

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- [Module specification](../src/docs/README.md)

This package is a published SDK plugin, not a deployable service, so no service specification or
OpenAPI document is generated. See `.sdd/manifest.json` `layout.artifact_decisions` for the
recorded reasoning.

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details. The published SDK surface is owned
by `src/index.ts` and `src/types.ts`; the Pragya and AI Bridge HTTP surfaces are externally owned and
are registered in `.sdd/manifest.json` `contract_catalog` rather than copied into Markdown.

## Related repository resources

- `README.md` — the npm-facing package readme, including the full end-to-end usage example
- `src/manual-pragya-api-test.js` and `src/manual-integration-test.js` — manual verification scripts
