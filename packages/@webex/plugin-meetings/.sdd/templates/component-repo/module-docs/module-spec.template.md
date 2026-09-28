<!-- ───────────────────────────────
  Template:     Module Spec
  Template-ID:  module-spec
  Generates:    <module-path>/ai-docs/<module-name>-spec.md by default, or the manifest's module docs path
  Description:  Per-module canonical spec — orientation plus requirements, design, invariants, flows, pitfalls, and tests.
  Library ver:  0.2.2
  Last updated: 2026-07-30
─────────────────────────────── -->

# <MODULE> — SPEC

> Start here → root [`AGENTS.md`](<relative-path-to-root-AGENTS.md>) (agent entry) · router [`SPEC_INDEX.md`](<relative-path-to-root-ai-docs/SPEC_INDEX.md>) · system [`ARCHITECTURE.md`](<relative-path-to-root-ai-docs/ARCHITECTURE.md>). This is the module's canonical spec: orientation, requirements, design, flows, state, protocol, UI, data, and tests. (Multi-repo: the root `AGENTS.md` may be the workspace-level one.)
> Context-efficiency: link to canonical docs — don't duplicate them. Load specs on demand per `SPEC_INDEX.md`.

<!--
  CANONICAL MODULE SPEC. This file is the module documentation surface for orientation, requirements,
  design, flows, state, protocol, UI, data, and tests. Save source-local as
  <module-path>/ai-docs/<module-name>-spec.md by default.
  Diagrams from real code;
  prefer Mermaid unless the repository already standardizes on another diagram format.
  This source-local file holds the module's orientation, design sections, diagrams, flows,
  relationships, use cases, state/concurrency/error/protocol detail where applicable, and module test
  strategy.
  Headings are flat and concrete; sections preceded by `<!-- Include if: ... -->` are kept only when
  the condition holds. Each section's comment gives Capture (what to write) / Avoid (the common mistake)
  / Example (a generic illustration).
-->

## Metadata
<!-- Capture: machine-readable doc identity, provenance, and validation state. Avoid: hiding these only in
     template comments or run records. Example: Module id `<module-id>`, Source `<module-path>/`, Coverage score `Pending coverage assessment`. -->
| Field | Value |
|---|---|
| Module id | `<module-id>` |
| Source path(s) | `<module source path(s)>` |
| Parent spec | the parent module's canonical spec at the manifest's module docs path, e.g. `<parent-module-path>/ai-docs/<parent-name>-spec.md` — or `—` when this module has no parent module |
| Doc kind | Module spec |
| Coverage score | Pending coverage assessment / `<percent>%` assessed `<YYYY-MM-DD>` |
| Generated from | `module-spec` @ SDLC template library `0.2.2` |
| generated_by / approved_by / updated_at | <provenance> |
| Validation status | not-run / pass / pass-with-warnings / blocked, validator `<runtime>`, assessed `<YYYY-MM-DD>` |

Coverage score: `Pending coverage assessment` before the first report; after assessment, replace with
`<0-100%>` plus the assessment date and short evidence summary. Do not link or cite local generated
coverage or validation report paths from this committed metadata. Keep manifest coverage state outside
the rendered module doc metadata.

## Evidence Rules
Every generated requirement below must cite concrete source evidence using `file path`. Separate source
evidence, test evidence, examples, assumptions, and gaps so validators and future agents can distinguish
truth from context. Test evidence is preferred for WHY. Commit evidence is allowed only when the
repository policy says history is reliable, and must include the commit hash. If evidence is missing or
conflicting, ask a focused discovery question before finalizing the requirement; record unresolved answers
as approved unknowns only when the human explicitly defers or does not know.

## Source Material Register
<!-- Capture: source basis categories and disposition for this canonical spec. Avoid: listing old
     non-canonical file paths such as prior AGENTS/ARCHITECTURE/spec snapshots, copying an entire
     source file, or adding a large quoted block. Exact old source paths belong in .sdd/manifest.json
     and local .generated source-fidelity reports. Preserve validated tables, diagrams, flows, and
     requirements in the matching sections by meaning; record stale/conflicting/unverifiable units in
     the run report. Example: "Reviewed prior module architecture docs | architecture | verified |
     station-login sequence moved to Sequence Diagram(s); stale cache note recorded in source-fidelity
     report." -->
| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| `<source-basis-or-N/A>` | overview / architecture / API / tests / none | used / verified / reference-only / stale / conflicting / none | <where the detail landed, or why it is unsupported/conflicting/not applicable> |

## Overview
<!-- Capture: the module's high-level orientation in 2-4 paragraphs: what it owns, how it is structured,
     and where a maintainer should start. Avoid: duplicating every requirement or listing files with no
     "why". Example: "`<module>` owns `<resource>` lifecycle; callers enter through `<public-api>`, which
     delegates to `<internal-unit>` so validation and persistence stay separate." -->
<module orientation>

## Purpose / Responsibility
<!-- Capture: in 1-2 sentences, the single thing this module owns. Avoid: a vague catch-all ("handles
     stuff") or listing everything it touches. Example: "Owns `<resource>` lifecycle: create, validate, and
     transition `<resource>`; does NOT own `<external capability>`." -->
<purpose>

<!-- Include if: the repo tiers its modules (e.g. Tier-1/Tier-2) [condition-id: module.has_tiers] -->
## Tier
<!-- Capture: this module's tier and what the tier implies (SLO, review bar). Avoid: inventing a tier the
     repo doesn't use. Example: "Tier-1 — customer-facing; changes need 2 reviewers + on-call sign-off." -->
**Tier:** <Tier-1 / Tier-2 / ...>

## Stack
<!-- Capture: language+version, framework, test stack, build wiring (datastore/messaging only if it has them).
     Avoid: copying the repo-wide stack when this module differs (polyglot). Example: "<language> <version>,
     <framework>, <test framework>; build target <module-target>." -->
<stack>

## Folder / Package Structure
<!-- Capture: the REAL tree globbed from disk, one-line role per dir. Avoid: an idealized/aspirational tree.
     Example: <module>/src/{api,domain,repo}/ with a one-line role each. -->
```
<module>/src/.../
├── <dir>/        # <one-line role>
```

<!-- Include if: this module contains child modules that own their own specs [condition-id: module.has_submodules] -->
## Sub-modules
<!-- Capture: one row per DIRECT child module that owns its own spec — the routed registry an agent follows
     to descend one level. Spec paths follow the manifest's module docs path, shown below with the default.
     Avoid: listing directories that have no spec of their own (those stay in Folder / Package Structure),
     listing indirect grandchildren, or restating a child's contents here. Example:
     "`<module>/src/<child>/` | <what the child owns> | Partial | `<module>/src/<child>/ai-docs/<child>-spec.md`". -->
| Sub-module | Responsibility | Manifest coverage state | Spec |
|---|---|---|---|
| `<child-module-path>/` | <one line> | <from `.sdd/manifest.json`> | `<child-module-path>/ai-docs/<child-name>-spec.md` |

Scope rule: every section below describes THIS module only. Behavior owned by a sub-module is recorded in
that sub-module's spec and referenced here by contract id — never duplicated, so a requirement is counted
once and at one level.

## Key Files (source of truth)
<!-- Capture: the files an agent must read and NOT infer values from (constants/config/schema, the export
     barrel, typed props). Avoid: listing every file — only the authoritative ones. Example: "config/
     limits.ts holds the rate caps; never hardcode them elsewhere." -->
| File | Holds |
|---|---|
| `<the real source-of-truth file(s)>` | <what it holds> |

## Public Surface
<!--
  Capture: how THIS module is consumed. Keep this compact: one row per public endpoint/export/event/command,
  plus short compatibility or deprecation notes. Link exact schemas/details instead of pasting them here:
    network API → OpenAPI `.yaml` link when available;
    events/messages → AsyncAPI `.yaml`, JSON Schema, or event source link;
    gRPC → `.proto`; GraphQL → `.graphql`;
    imported SDK/code API → exported declarations, API report, or package entry point.
  Avoid: a vague "API" heading, documenting internal helpers as public, or turning this spec into a full
  schema dump. If there is no external contract, write "Internal Surface — internal use only" and list the
  entry points other modules call.
  Example: "billing.invoice.get | HTTP | GET /invoices/{id} | fetch invoice | stable; additive response fields only | openapi.yaml#/paths/... | ai-docs/CONTRACTS.md#api-endpoints".
-->
| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `<module>.<surface>` | HTTP / SDK / event / CLI / RPC | <method+path, symbol, event, command> | <why callers use it> | <stability and deprecation note> | `<schema-or-api-detail>` | `<relative-path-to-root-ai-docs/CONTRACTS.md>` |

Compatibility notes:
- <additive/change/removal rule; consumer transition or deprecation window if applicable>

## Requires (dependencies)
<!-- Capture: what the module needs IN — internal modules, external services (+fallback), datastore/infra,
     peer libs (+version floor). Avoid: omitting fallbacks/version floors. Example: "<cache/store> (temporary verifier store, bounded
     TTL, fail-closed); <shared-lib> ^2.3." -->
<requires>

## Requirements
<!-- Capture: observable behavior, public contracts, invariants, and compatibility promises that must be
     preserved. Avoid: turning data inventory into requirements. Tables, fields, entities, migrations, and
     cache keys belong in Data / Schema, Schema / Migration Discipline, or Data Model sections below. -->
| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `<MODULE>-R-001` | <observable behavior or contract the module must preserve> | <rationale from tests/usage/history, or approved unknown> | `<source-file>` | `<test-file>` / `<example-file>` / none found | <assumption, gap, or none> | PRESENT / WEAK / APPROVED_UNKNOWN |

Do not merge multiple unrelated behaviors into one requirement. Do not use broad evidence such as
"see source tree" or only an intake/questionnaire record; cite the implementation/test files that support
the claim. Do not record raw data/schema inventory as requirements.

## Design Overview
<!-- Capture: how the module works internally and why it's structured this way (2-4 paragraphs).
     Avoid: restating the overview or listing files with no "why". Example: "Splits intake validation from
     processing rules so retries never re-validate; processor is pure + unit-testable." -->
<design overview>

## Data Flow
<!-- Capture: how data moves through the module (inputs → transforms → outputs), naming the EXACT transport
     (HTTP / WebSocket / gRPC / queue / in-process). Avoid: leaving transport vague — a frequent doc error.
     Example: "Request → validator → domain service → repository (<store>); events emitted to the bus." -->
```mermaid
<data-flow diagram>
```

## Sequence Diagram(s)
<!-- Capture: the sequence inventory first, then one sequence per major operation group. Count operation
     groups from public surfaces, use cases, events, commands, state transitions, and async jobs. Merge
     operations into one diagram only when they share the same actors, ordering, transport, state transition,
     and failure behavior. Include error/timeout/retry/rejected/rollback/recovery paths. Avoid: one generic
     happy-path diagram for a module with multiple behaviors. Example: a mermaid sequenceDiagram showing
     client → service → store, plus the timeout → retry branch. -->
Sequence coverage:

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| `<operation group>` | `<diagram title>` | <alt/opt branch or separate diagram covering error/timeout/retry/rejected/rollback/recovery> |

```mermaid
<sequence diagram for each major operation — prefer mermaid sequenceDiagram; include error/timeout paths>
```

## Class / Component Relationships
<!-- Capture: the key types and how they relate (inheritance, composition, DI). Avoid: an exhaustive dump of
     every class. Example: a class diagram of Service → Repository interface ← two implementations. -->
```mermaid
<class or component diagram>
```
<Narrative of the key types and how they relate.>

## Use Cases
<!-- Capture: the concrete flows the module supports (actor → steps → outcome). Avoid: vague capability names
     with no steps. Example: "UC-1 Process item: caller submits → validate → persist → emit ItemProcessed." -->
- **UC-1 <name>:** <actor → steps → outcome>. Evidence: `<source-file>`, `<test-file>`.
<!-- Include if: this module has a UI — add the UI flow (screens, states, user actions) per use case [condition-id: module.has_ui] -->
<!-- Include if: this module crosses service boundaries (network API or events) — add the cross-service flow per use case [condition-id: module.crosses_service_boundaries] -->

<!-- Include if: this module holds client-side state [condition-id: module.holds_client_state] -->
## State Model
<!-- Capture: the state shape (store/slices) and what triggers transitions. Avoid: documenting server data
     here. Example: "<state-slice> {items, total}; ADD_ITEM/REMOVE_ITEM recompute total." -->
<state model>

<!-- Include if: the module enforces domain rules or entity invariants [condition-id: module.enforces_domain_rules] -->
## Business Rules & Invariants
<!-- Capture: the rules that must ALWAYS hold (lifecycles, validation, state constraints) + where enforced
     (file path). Avoid: mixing these with pitfalls. Example: "An order can't leave DRAFT without ≥1 line
     item — enforced in <OwnerService>.submit (<owner-service>.ts)." -->
- <invariant — and where it is enforced>

<!-- Include if: the module is concurrent / async / reactive / event-driven [condition-id: module.is_concurrent_async] -->
## Concurrency & Reactive Flow
<!-- Capture: the async/threading model — what runs concurrently, ordering guarantees, what must be
     non-blocking, idempotency/retry, shared-state protection. Avoid: assuming single-threaded when it isn't.
     Example: "Handlers are stateless; the same event may arrive twice — upsert keyed by event id." -->
- <concurrency model; ordering/idempotency guarantees; what NOT to block>

<!-- Include if: the module owns persistence (its own tables/store) [condition-id: module.owns_persistence] -->
## Data / Schema
<!-- Capture: the tables/collections this module owns, key fields, and the migration rule. Avoid: documenting
     data another module owns. Example: "Owns `<items>` (id, state, updated_at); migrations in db/migrations/,
     expand→migrate→contract." Keep this as descriptive data inventory, not requirement rows. -->
- <owned stores + key schema + migration discipline>

<!-- Include if: this module owns persistence (a datastore + migrations) [condition-id: module.owns_persistence] -->
## Schema / Migration Discipline
<!-- Capture: where migrations live, numbering/ordering, the migration-is-source-of-truth rule. Avoid:
     hand-editing shipped migrations. Example: "db/migrations/NNNN_*.sql, monotonic; never edit a shipped one." -->
<migration discipline>

<!-- Include if: the module is stateful with non-trivial transitions [condition-id: module.stateful_transitions] -->
## State Machine
<!-- Capture: states, transitions, guards, terminal states, and invalid transitions. Avoid: mixing state
     transitions into generic requirements. -->
```mermaid
<state diagram>
```

<!-- Include if: the module exposes a wire protocol/format [condition-id: module.exposes_wire_protocol] -->
## Protocol / Wire Format
<!-- Capture: message/frame shape, versioning, compatibility rules, and parser/serializer ownership. Avoid:
     leaving parser/serializer ownership implicit. -->
- <protocol or wire-format details>

<!-- Include if: the module is UI with a multi-screen flow [condition-id: module.ui_multi_screen] -->
## UI Flow
<!-- Capture: screens, states, user actions, empty/loading/error states, and accessibility constraints. Avoid:
     omitting non-happy-path UI states. -->
- <UI flow details>

<!-- Include if: the module owns a large/complex data model [condition-id: module.large_data_model] -->
## Data Model
<!-- Capture: entities, relationships, ownership, lifecycle, retention, and migration notes. Avoid:
     recording table/field inventory as requirements. -->
- <data model details>

<!-- Include if: the module returns/raises errors a caller must handle [condition-id: module.returns_caller_errors] -->
## Error Handling & Failure Modes
<!-- Capture: the errors/result types the module produces, when each fires, and how a caller recovers. Avoid:
     swallowing errors or returning a bare null. Example: "Returns NotFound (unknown id) and Conflict
     (stale version); callers retry Conflict once after re-reading." -->
| Condition | Signal (error/code/result) | Caller recovery |
|---|---|---|

## Pitfalls
<!-- Capture: the latent-bug edges mined from incidents/tribal knowledge, and how to avoid each. Avoid: generic
     advice ("handle errors"). Example: "Timestamps are stored UTC but the legacy column is local — convert
     on read or reports drift by the offset." -->
- <non-obvious behavior / failure mode that has bitten or could bite; how to avoid it>

<!-- Include if: this module has specific conventions beyond the repo-wide rules [condition-id: module.module_specific_conventions] -->
## Module Do's / Don'ts
<!-- Capture: conventions extracted from real code unique to this module. Avoid: repeating repo-wide rules.
     Example: "DO emit <ResourceChanged> after every state write; DON'T mutate `<resource>` outside `<OwnerService>`." -->
- DO: <module-specific convention>
- DON'T: <module-specific pitfall>

<!-- Include if: this module is published/consumed as a package [condition-id: module.published_package] -->
## Export Stability
<!-- Capture: semver sensitivity of exports, the type-declaration surface, sample usage. Avoid: a breaking
     export change without a major bump. Example: "Adding an optional field = minor; removing one = major." -->
<export stability>

<!-- Include if: this module is embedded into a host application [condition-id: module.embedded_in_host] -->
## Host Integration & Theming
<!-- Capture: theming/provider needs, custom-element/tag names, the host-mount contract. Avoid: assuming the
     host's framework version. Example: "Mounts as <order-widget>; requires ThemeProvider; peer react ^18." -->
<host integration>

<!-- Include if: the module has a non-obvious design trade-off a consumer must know [condition-id: module.has_design_tradeoff] -->
## Key Design Trade-off
<!-- Capture: the deliberate trade-off and the invariant it preserves. Avoid: presenting it as a limitation
     with no rationale. Example: "Stable item identity is favored over pagination simplicity — cursors encode
     identity, not offset, so inserts don't shift pages." -->
- <trade-off chosen, what it preserves, what it costs>

## Test-Case Strategy (module)
<!-- Capture: unit boundaries, what each test asserts (a positive AND a negative case), key edge cases,
     eventual-consistency handling. Avoid: only-happy-path tests, or restating a change-level test plan.
     Example: "submit() — asserts persisted+event emitted (positive) AND rejects empty order (negative)." -->
<module test approach>

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `<MODULE>-R-001` | `<test-file>` or `None found` | <missing negative case / missing edge case / none> |

## Traceability
<!-- Capture: the links up/out so a reader can navigate. Avoid: dead links or omitting the manifest. -->
- Repo architecture: `<relative-path-to-root-ai-docs/ARCHITECTURE.md>` · Registry: `<relative-path-to-root-ai-docs/SPEC_INDEX.md>`
- Coverage state & contracts baseline: `.sdd/manifest.json`
