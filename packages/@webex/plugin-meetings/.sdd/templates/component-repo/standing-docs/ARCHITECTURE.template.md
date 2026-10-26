<!-- ───────────────────────────────
  Template:     ARCHITECTURE
  Template-ID:  architecture
  Generates:    ai-docs/ARCHITECTURE.md
  Description:  Repo/component architecture — components, responsibilities, interactions, cross-cutting posture.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# ARCHITECTURE — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md). This is the system architecture; per-module detail lives in each manifest-routed module spec, source-local as `<module-path>/ai-docs/<module-name>-spec.md` by default.
> Context-efficiency: link to canonical docs — don't duplicate them; this loads on demand, not upfront.

<!--
  ROOT FILE 2 of 3. Repo/component-level architecture — components, their RESPONSIBILITIES, and how they
  interact. Distinct from a single module's source-local spec at
  <module-path>/ai-docs/<module-name>-spec.md. Diagrams from real code, never from memory.
  Headings are flat; universal sections are always present (name each for what the repo IS); sections
  preceded by `<!-- Include if: ... -->` are kept only when the condition holds. Each section comment gives
  Capture / Avoid / Example.
-->

## Design Overview
<!-- Capture: the system's purpose, shape, and the key design choices that explain why it looks like this.
     Avoid: a feature list with no rationale. Example: "Event-driven so intake and processing scale
     independently; `<component>` is the single writer for `<domain object>`." -->
<2-3 paragraphs>

## Component Inventory & Responsibilities
<!-- Capture: one row per component with a SINGLE clear responsibility + docs link. Avoid:
     a component that "does everything" or a missing owner. Example: "`<module-a>/` — <single responsibility> —
     <module-a>/ai-docs/<module-a>-spec.md". -->
| Component | Responsibility (one line) | Docs |
|---|---|---|
| `<module>/` | <what it owns> | `<module-path>/ai-docs/<module-name>-spec.md` |

## Component Interaction
<!-- Capture: a diagram of components + the calls/events/imports between them, plus a narrative of the main
     paths. Avoid: a box-only diagram with no edges. Example: "<edge> → <module-a> → <module-b>; <module-b> emits <DomainEvent>." -->
```
<diagram: components + the calls/events/imports between them. mermaid or puml.>
```
<Narrative: the main paths; entry points; who calls/imports whom.>

## Execution & Flow
<!--
  Capture: the representative end-to-end flow, grounded in real code (file path); NAME the heading for what
  the repo is — service → "Request / Event Flow"; per-call fn → "Invocation Flow"; library → "Init & Call
  Flow"; batch → "Pipeline / Job Flow"; build tool → "Build / Generation Flow".
  Avoid: a vague heading like "Flow", or describing intended (not actual) flow.
  Example (service): "POST /<resource> → validate → <component>.save → emit <ResourceCreated> → 201."
-->
<the representative end-to-end flow for this repo>

## Dependencies
<!-- Capture: each dependency, how it's used, and its failure/version handling. Avoid: omitting fallback or
     version floor. Example: "<cache/store> | external | idempotency keys | fail-closed, bounded TTL." -->
| Dependency | Type (internal / external / peer) | How used | Failure / version handling |
|---|---|---|---|
| <dep> | <type> | <usage> | <fallback / peer-range / timeout> |

<!-- Include if: the repo owns a datastore (persists its own data) [condition-id: repo.owns_datastore] -->
### Data & Schema
<!-- Capture: the datastores, key schemas, cache patterns, migration discipline. Avoid: data owned elsewhere.
     Example: "<datastore> `<entity_table>`, `<event_table>`; migrations expand→migrate→contract." -->
- <datastores, key schemas, cache patterns, migration discipline>

<!-- Include if: the repo holds client-side state (UI store / in-memory session model) [condition-id: repo.holds_client_state] -->
### State Model
<!-- Capture: the state shape (store/slices) and what triggers transitions. Avoid: documenting server data.
     Example: "<flow> slice {step, data}; NEXT_STEP advances; RESET on success." -->
- <the state shape and what triggers transitions>

## Cross-Cutting Concerns
<!-- Capture: the security + observability posture every change must respect. Avoid: "TBD" — every repo has
     some posture. Example: "Security: tokens checked at the boundary, secrets from managed storage. Observability: structured logs +
     correlation id; request/error/duration metrics per route." -->
- **Security:** <authn/authz model, secret/token handling, sensitive-data rules>
- **Observability:** <logs/metrics/traces + correlation ids for a service; telemetry/error reporting for a client artifact>

## Non-Functional Posture
<!--
  Capture: the quality/scale expectations, NAMING the heading for what the repo is — service → "Scale & SLOs";
  library → "Footprint & Compatibility"; UI app → "Performance & Accessibility"; CLI → "Performance &
  Footprint"; batch → "Throughput & Cost". Avoid: copying numbers from another system.
  Example (service): "Scale & SLOs — <target throughput>, p99 < <latency bound>, horizontal autoscale."
-->
<the non-functional posture in the form that fits this repo>

<!-- ===== Conditional extras — keep a section only when its Include-if condition holds ===== -->

<!-- Include if: components/services call each other or exchange events (most non-trivial repos) [condition-id: repo.components_interact] -->
## Dependency / Interaction Topology
<!-- Capture: the who-calls-whom call graph AND the event topology, as a first-class view. Avoid: burying it
     in prose. Example: graph edges "<edge>→<module-a> (call)", "<module-b>→<bus> <DomainEvent> (event)". -->
```
<call + event graph: nodes are components/services, edges are calls (sync) and events (async)>
```
| From | To | Kind (call / event) | Purpose |
|---|---|---|---|

<!-- Include if: the repo owns domain data spread across components [condition-id: repo.domain_data_across_components] -->
## Object / Data Ownership
<!-- Capture: each domain object → the single component that may write it. Avoid: two components writing the
     same object. Example: "<DomainObject> → <writer component>; read by <reader component>." -->
| Domain object | System-of-record (owning component) | Read by |
|---|---|---|

<!-- Include if: the repo caches data [condition-id: repo.caches_data] -->
## Caching Catalog
<!-- Capture: each cache, backend, what it holds, TTL, invalidation. Avoid: a cache with no invalidation rule.
     Example: "<resource-cache> | <cache backend> | <resource by key> | 60s | invalidate on <ResourceChanged>." -->
| Cache | Backend | What it holds | TTL | Invalidation trigger |
|---|---|---|---|---|

<!-- Include if: the repo has a logging/metrics/audit convention worth standardizing [condition-id: repo.observability_convention] -->
## Observability Patterns
<!-- Capture: the logging format + id propagation, metric naming + key signals, what is audited. Avoid:
     logging secrets/PII (see SECURITY). Example: "JSON logs w/ correlation_id; metrics <prefix>_*; audit on privileged changes." -->
- **Logging:** <structured format, correlation/request id propagation, what is never logged>
- **Metrics:** <naming convention, key signals, where dashboards live>
- **Audit:** <what is audited and where>

<!-- Include if: the repo deploys to / depends on infrastructure [condition-id: repo.deploys_to_infra] -->
## Infrastructure Matrix
<!-- Capture: the datastores, messaging, and cloud services actually in use. Avoid: aspirational infra.
     Example: "Datastores: <db>; Messaging: <broker>; Cloud/platform: <service>." -->
| Category | In use | Notes |
|---|---|---|
| Datastores | <db(s)> | |
| Messaging / streaming | <broker(s)> | |
| Cloud / platform services | <services> | |

<!-- Include if: the repo inherits a shared/base library stack every module uses [condition-id: repo.shared_base_libs] -->
## Shared / Base Libraries
<!-- Capture: the shared libs every module inherits + version floor. Avoid: listing app deps here. Example:
     "<shared-logging> (^3) — structured logger + correlation-id filter." -->
| Library | What every module inherits from it | Version floor |
|---|---|---|

<!-- Include if: the repo is a monorepo (multiple packages in one tree) [condition-id: repo.is_monorepo] -->
## Package Map & Inter-Package Dependencies
<!-- Capture: workspace globs, package→responsibility (+ public/internal visibility), inter-package graph,
     version-sync rule. Avoid: hidden cyclic deps. Example: "packages/* ; <adapter> depends on <core>; <core> depends on none." -->
- Workspace tooling and the workspace globs.
- Package → responsibility table, with a **visibility** column (public / internal) where it applies.
- Inter-package dependency graph (incl. workspace-internal deps) + the release/version-sync rule.
- Per-package notes where a package is a different kind than the repo (e.g. a library package next to an app).

<!-- Include if: the repo targets multiple platforms (mobile / desktop / embedded / cross-platform) [condition-id: repo.multi_platform] -->
## Platform Matrix
<!-- Capture: per-platform the shared-core vs per-platform split + entry/build. Avoid: assuming one platform's
     build works for all. Example: "iOS | shared core + SwiftUI shell | xcodebuild." -->
| Platform | Shared core vs per-platform | Entry / build | Notes |
|---|---|---|---|
| <platform> | <split> | <build> | |

<!-- Include if: the repo is published/consumed as a package (npm/Maven/PyPI/etc.) [condition-id: repo.published_package] -->
## Release & Versioning
<!-- Capture: publish target, semver rules, deprecation policy, changelog obligation. Avoid: breaking changes
     without a major bump. Example: "Published to the internal npm registry; semver; 1 minor deprecation window." -->
- Publish target; semver rules; deprecation policy; consumer-facing changelog obligation.

<!-- Include if: the repo is embedded into a host application (widget / micro-frontend / extension) [condition-id: repo.embedded_in_host] -->
## Host Integration & Theming
<!-- Capture: how a host mounts/embeds it, required providers, pinned theme/peer versions. Avoid: assuming the
     host's framework version. Example: "Mounts as <pay-widget>; needs ThemeProvider; peer react ^18." -->
- How a host application mounts/embeds this; required host providers; pinned design-token/theme versions;
  peer/host-framework version floors.

<!-- Include if: cross-repo dependencies are material (consumed/published artifacts usually qualify; common in topology A) [condition-id: repo.cross_repo_deps_material] -->
## Cross-Repo Dependency Graph
<!-- Capture: the repos this one consumes or is consumed by + what's exchanged. Avoid: an unscoped "see other
     repos". Example: "Consumes shared-contracts (event schemas); consumed by reporting-svc." -->
- **Internal (same org):** <repos + what's exchanged>
- **Cross-project:** <repos + contract>
- **External read-only:** <repos referenced, not modified>
- **External services:** <APIs/backends called>

<!-- Include if: the security architecture warrants its own view (trust boundaries, identity flow) [condition-id: repo.security_arch_warranted] -->
## Security Architecture
<!-- Capture: trust boundaries, token/identity flow, encryption at rest/in transit. Avoid: duplicating
     SECURITY.md — keep this to the architectural view. Example: "mTLS between services; tokens minted at edge." -->
<trust boundaries, token/identity flow, encryption at rest/in transit>

---
→ Per-module orientation and detailed design live in each manifest-routed module spec, source-local as `<module-path>/ai-docs/<module-name>-spec.md` by default. Routing: `SPEC_INDEX.md`.

## Architecture Reference Links
<!-- Capture: links to the local decision, pattern, and rule docs that explain or constrain this
     architecture. Avoid: restating those docs here; summarize only why architecture readers should
     consult them. -->
| Reference | Location | When to read |
|---|---|---|
| Architecture decisions | `adr/` | To understand why major design choices were made and what alternatives were rejected |
| Repo patterns | `patterns/` | To follow established implementation conventions reflected in this architecture |
| Enforceable rules | `RULES.md` + `rules/` | To understand constraints every architecture-affecting change must obey |

## WS6 References
<!-- Capture: links to WS6 specs, platform architecture, shared service architecture, or enterprise
     architecture documents when they exist. Avoid: copying WS6 content into this component repo doc;
     link to the authoritative WS6 source and summarize only the local implication. -->
| WS6 artifact | Relevance to this repo | Link |
|---|---|---|
| <WS6 spec / architecture doc> | <why this repo should read it> | <url/path when available> |
