<!-- ───────────────────────────────
  Template:     Contracts Catalog
  Template-ID:  contracts
  Generates:    ai-docs/CONTRACTS.md
  Description:  Standing as-built public-surface catalog (Provides/Requires) + compatibility policy.
  Library ver:  0.2.2
  Last updated: 2026-07-11
─────────────────────────────── -->

# Contracts Catalog — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this root contract index; detailed contracts live with owning modules or canonical schema files. Machine source `.sdd/manifest.json`.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc — the repo's stable public-surface index (the manifest's Provides/Requires promoted
  to a doc). Prevents re-creating an existing endpoint/event or breaking a consumer. Detailed schemas and
  operation-level behavior belong in native schema/API files or module-local specs.
  Keep this file compact: one row per public surface, with owner, compatibility, and a detail link. Headings are flat;
  sections preceded by `<!-- Include if: ... -->` are kept only when the
  condition holds. Each section comment gives Capture / Avoid / Example. Fill from real code (file path).
-->

> Read before adding any public-facing surface — check here first. Machine source of truth: `.sdd/manifest.json`.
> Schema convention: prefer `.yaml` for OpenAPI/AsyncAPI unless this repo already standardizes on `.yml`; use
> `.proto`, `.graphql`, JSON Schema, or language-native SDK API outputs when those are the natural source.
> Do not inline large schemas here.

<!-- Include if: the repo exposes a network/HTTP API -->
### API Endpoints
<!-- Capture: each public route — stable id, owner module, method+path, purpose, auth/scope, compatibility,
     schema/detail link, where defined. Avoid: listing internal routes as public or pasting full schemas.
     Example: "billing.invoice.get | billing/ | GET /<resource>/{id} | fetch <resource> |
     scope read:<resource> | stable; additive fields only | openapi.yaml#/paths/... | routes/<resource>.ts." -->
| Contract ID | Owner module | Method + path | Purpose | Auth / scope | Compatibility / deprecation | Schema / detail link | Defined at |
|---|---|---|---|---|---|---|---|

<!-- Include if: the repo is imported as a library/package -->
### Exported API & Types
<!-- Capture: each public symbol + owner package/module + signature + semver stability + detail link. Avoid:
     documenting non-exported internals or inventing custom YAML for SDK APIs. Example:
     "sdk.client.create | packages/sdk | createClient(opts): Client | stable semver surface |
     api-report.md#createClient | index.ts." -->
| Contract ID | Owner module/package | Symbol | Signature | Stability / deprecation | Schema / detail link | Defined at |
|---|---|---|---|---|---|---|

<!-- Include if: the repo publishes or consumes events/messages -->
### Events
<!-- Capture: each event — owner module, direction, payload schema link, delivery guarantees, deprecation.
     Avoid: omitting ordering/delivery semantics or pasting large payloads. Example:
     "billing.invoice.created | billing/ | publish | asyncapi.yaml#/channels/... | at-least-once |
     additive fields only | events/<resource>.ts." -->
| Contract ID | Owner module | Event / topic | Direction (publish/consume) | Payload schema link | Delivery guarantees | Compatibility / deprecation | Defined at |
|---|---|---|---|---|---|---|---|

<!-- Include if: the repo exposes a CLI -->
### Commands & Flags
<!-- Capture: each command, owner module, args/flags, exit codes, compatibility, where defined. Avoid:
     undocumented exit codes. Example: "sync.job | cli/ | sync --since DATE | exit 0 ok / 2 bad-args |
     stable flags | cli/sync.ts." -->
| Contract ID | Owner module | Command | Args / flags | Exit codes | Compatibility / deprecation | Defined at |
|---|---|---|---|---|---|---|

## Requires — what this repo depends on
<!-- Capture: each outward dependency's consumed contract + availability assumption + fallback + version floor.
     Avoid: omitting the fallback. Example: "rates-svc | GET /rates | assume 99.9% | cache last-good | v2." -->
| Dependency (service / package / datastore) | What is consumed | Schema / detail link | Availability assumption | Fallback on failure | Version floor |
|---|---|---|---|---|---|

## Compatibility & Deprecation Policy
<!-- Capture: the rule for changing the above without breaking consumers. Avoid: a breaking change with no
     version bump/window. Example: "No breaking change without a major bump + 1-release deprecation window." -->
- **Breaking-change rule:** <e.g. no breaking change without a version bump + consumer transition note + deprecation window>
- **Deprecation:** <how a surface is marked deprecated and for how long>

<!-- Include if: a non-trivial interface needs full schema/error detail beyond this catalog -->
## Detailed Interface Docs
<!-- Capture: links to native schema/API files and per-interface docs (schema, error catalog, backward-compat).
     Avoid: inlining huge schemas here. Example: "<Resource API> → openapi.yaml#/paths/... and
     design/contracts/<resource-api>.md." -->
- Large/critical interfaces link to their canonical schema/API source and, when needed, a
  module-local contract doc.

## Maintenance
<!-- Capture: the rule that keeps the catalog + manifest in sync. Avoid: updating one and not the other. -->
- When a public surface is added/changed/removed, update this catalog, the owning module spec summary,
  any canonical schema/API detail source, and `.sdd/manifest.json` in the same change.
- For incompatible changes, include the consumer transition/deprecation plan in the owning contract detail and
  summarize it in the Compatibility / deprecation column.
- Cross-reference: domain terms → `GLOSSARY.md`; entities → `DATA_MODEL.md`.
