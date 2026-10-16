---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-16T01:43:45Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module
specification plus native contract for `@webex/internal-plugin-conversation`. Keep technical facts
in one owning document and use this page only for navigation, ownership, status, and change/test
routing.

Start with the [repository architecture](../architecture.md). This package has no deployable
service, so no service specification exists.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Repository architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, cross-cutting architecture, and the contract index |
| Module specifications | Stable behavior and design at each manifest-routed `src/docs/README.md` |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences, and supersession lineage |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Repository | Architecture | `docs/architecture.md` | Cisco Webex for Developers | Draft | 2026-10-15 |
| Conversation plugin | Module | `src/docs/README.md` | Cisco Webex for Developers | Draft | 2026-10-15 |
| conversation-package-entry | Contract | `package.json` | Cisco Webex for Developers | Active | 2026-10-15 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Conversation client, KMS payload transforms, file sharing, and thread ordering | Partial | `src/docs/README.md` |

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | Unit tests plus the affected module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-conversation test:unit` |
| A public API, event, command, package, or file contract | The architecture contract index, the module Public surface, and the native source | Unit tests plus dependent-package review |
| Payload transforms or encryption | `src/docs/README.md` Protocol, Failure modes, and Module-specific rules | Unit transform specs plus integration encryption specs |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Contracts are registered in `contract_catalog` with stable IDs, publication
state, and native source, and indexed in the architecture's Public and consumer surfaces section.
This package publishes an SDK surface whose native source is `package.json` plus the files under
`src/`; it owns no HTTP surface and needs no OpenAPI document.
