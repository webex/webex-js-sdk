<!-- ───────────────────────────────
  Template:     Service State (living)
  Template-ID:  service-state
  Generates:    ai-docs/SERVICE_STATE.md
  Description:  Living as-built registry — current endpoints/events/stores/deps/limits/metrics/flags; read first to avoid duplicates.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Service State (living) — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Read this FIRST before adding a surface; stable contracts in `CONTRACTS.md`.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING, LIVING current-state registry — the as-built snapshot of what this service exposes and depends on
  RIGHT NOW. Read FIRST before adding an endpoint/event/dependency, to avoid duplicating or breaking it.
  Describes reality, not intent. Headings are flat; sections preceded by `<!-- Include if: ... -->` are kept
  only when the condition holds. Each section comment gives Capture / Avoid / Example. Fill from real
  code/config (file path) at the current SHA.
-->

> Source of truth for "does X already exist?" Keep current in the same change that adds/removes a surface.

<!-- Include if: the service exposes endpoints -->
## Current Endpoints
<!-- Capture: every endpoint that exists now — method+path, handler, auth/scope, gating flag. Avoid: listing a
     planned endpoint. Example: "GET /<resource> | <ResourceController>.list | read:<resource> | (no flag)." -->
| Method + path | Handler / controller | Auth / scope | Feature flag (if any) |
|---|---|---|---|

<!-- Include if: the service publishes or consumes events -->
## Current Events
<!-- Capture: each event in/out now + producer/consumer + payload ref. Avoid: omitting direction. Example:
     "<ResourceCreated> | publish | <module> | events/<resource>.ts." -->
| Event / topic | Direction | Producer/consumer | Payload ref |
|---|---|---|---|

<!-- Include if: the service owns or uses data stores -->
## Data Stores
<!-- Capture: each store, its purpose, and whether THIS service owns it. Avoid: claiming ownership of a shared
     store. Example: "<datastore> `<resource_table>` | <resource> records | owned: yes." -->
| Store | Purpose | Owned by this service? |
|---|---|---|

## External Dependencies
<!-- Capture: each outbound dependency + resilience (timeout/retry, breaker/fallback). Avoid: a dependency with
     no timeout. Example: "<external-service> | <lookup purpose> | 2s timeout, 3 retries | breaker → last-good cache." -->
| Dependency | Used for | Timeout / retry | Circuit breaker / fallback |
|---|---|---|---|

<!-- Include if: the service enforces rate limits / quotas -->
## Rate Limits & Quotas
<!-- Capture: each limited surface + the limit + its scope. Avoid: an undocumented limit that surprises callers.
     Example: "POST /<resource> | 100/min | per API key." -->
| Surface | Limit | Scope (per user/tenant/global) |
|---|---|---|

<!-- Include if: the service has defined SLOs / performance targets -->
## Key Metrics & Performance Targets
<!-- Capture: the signals that matter + their target + where measured. Avoid: vanity metrics with no target.
     Example: "p99 latency | < 200ms | dashboard X." -->
| Signal | Target | Where measured |
|---|---|---|

## Feature Flags (current)
<!-- Capture: each live flag — what it gates, current default, owner, removal condition. Avoid: re-adding or
     mis-defaulting an existing flag. Example: "<newCapability> | new capability path | OFF | <owner> | remove after GA." -->
| Flag | Gates | Current default | Owner | Safe to remove when |
|---|---|---|---|---|

<!-- Include if: the service holds compliance certifications/obligations worth surfacing -->
## Compliance / Certifications
<!-- Capture: the obligations an agent must not regress. Avoid: omitting a regulated constraint. Example:
     "PCI scope: card data never logged or stored in plaintext." -->
- <relevant obligations an agent must not regress>

## Maintenance
<!-- Capture: update the relevant row in the SAME change that alters a surface/dep/limit/flag. Avoid: letting
     the registry drift from reality. -->
- Update the relevant row in the same change that adds/changes/removes a surface, dependency, limit, or flag.
- Cross-reference: stable contracts → `CONTRACTS.md`; entities → `DATA_MODEL.md`; security posture → `SECURITY.md`.
