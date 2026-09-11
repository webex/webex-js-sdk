<!-- ───────────────────────────────
  Template:     Spec Index
  Template-ID:  spec-index
  Generates:    ai-docs/SPEC_INDEX.md
  Description:  Router — which docs to load for which task and the canonical module registry.
  Library ver:  0.2.2
  Last updated: 2026-07-31
─────────────────────────────── -->

# Spec Index — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry). This file is the router (generated at `ai-docs/SPEC_INDEX.md`); system overview in [`ARCHITECTURE.md`](ARCHITECTURE.md). Load `AGENTS.md` + this file first; pull every other doc on demand.
> Context-efficiency: link to canonical docs — don't duplicate them; route to the minimum needed per task.

<!--
  ROOT FILE 3 of 3. The ROUTER — tells an agent which docs to load for which task; holds the module
  registry and incident-history reference rows. Human-readable mirror of
  .sdd/manifest.json. Headings are flat; sections preceded by `<!-- Include if: ... -->` are kept only when
  the condition holds. Each section comment gives Capture / Avoid / Example.
-->

> AI agent entry point after `AGENTS.md`. Load this once at session start; pull other docs on demand.
> **Source of truth:** `.sdd/manifest.json` (this file mirrors it for humans).

## Module Registry
<!-- Capture: one row per module mirroring the manifest — responsibility, manifest coverage state, and
     the module spec link. Module-specific details live in the single module spec, so this router stays
     compact. Avoid: drifting from .sdd/manifest.json (it is authoritative).

     NESTING: modules form a tree. Show depth with one `↳ ` prefix per level BEFORE the backticked path,
     never inside it, and keep rows in depth-first order so each child follows its parent. Depth must
     increase by at most one per row — a jump means a parent row is missing. Keep the table at four
     columns; depth lives in the Module cell, not a fifth column. A top-level module carries no prefix.

     A child's path always BEGINS WITH its parent's path, but the two need not be adjacent: source-layout
     directories that are not themselves modules (`src/`, `main/`, `java/`, `res/`…) sit in between and are
     written out in full. They do not add depth — one `↳ ` per MODULE level, never one per path segment. So
     a module at `billing/src/main/java/ledger/` whose nearest module ancestor is `billing/` is depth 1 and
     takes a single marker.
     Example:
     "`<module>/`                     | <responsibility>       | manifest state | `<module-path>/ai-docs/<module-name>-spec.md`
      ↳ `<module>/src/main/<child>/`  | <what the child owns>  | manifest state | `<module>/src/main/<child>/ai-docs/<child>-spec.md`" -->
| Module | Responsibility | Manifest coverage state | Start here |
|---|---|---|---|
| `<module>/` | <one line> | <from `.sdd/manifest.json`> | `<module-path>/ai-docs/<module-name>-spec.md` |
| ↳ `<module>/.../<child>/` | <one line> | <from `.sdd/manifest.json`> | `<module>/.../<child>/ai-docs/<child>-spec.md` |

## Task Routing
<!-- Capture: for each kind of work, exactly which docs to load (keep token usage low). Avoid: "load
     everything". Example: "Working in a module → that module's spec; load the relevant section only." -->
| If the task is… | Load |
|---|---|
| Understanding the system | `ARCHITECTURE.md` |
| Working in `<module>` | `<module-path>/ai-docs/<module-name>-spec.md` |
| A cross-service contract change | the relevant contract docs + `ARCHITECTURE.md` interaction section |
| Running or changing tests | `TEST_INDEX.md` + the affected module spec or feature test strategy |
| Updating docs after a code change | affected module specs + relevant standing indexes/contracts |
| Migrating existing specs | manifest source routes + affected module specs + source-fidelity report |

## Incident History
<!-- Capture: a one-line REFERENCE row per incident with a link to the full RCA (ticket/wiki). Avoid: pasting
     full RCAs here. Example: "INC-3014 | 2026-05-02 | <module>/ | <failure mode> | <link>". -->
| INC id | Date | Module | One-line | Link |
|---|---|---|---|---|
| <INC-xxxx> | <YYYY-MM-DD> | `<module>/` | <what happened> | <url> |

<!-- Include if: the repo is large enough that phase-based on-demand spec loading is worthwhile -->
## Phase-Based Loading Protocol
<!-- Capture: which docs to load per phase to bound token usage. Avoid: front-loading every spec. Example:
     "Orient → AGENTS + this file; Build → the one module spec + its rules." -->
| Phase | Load |
|---|---|
| Orient | AGENTS.md + this file |
| Specify | relevant module docs and routed source specs |
| Build | the selected module SPEC(s) + patterns/rules |
| Verify | independent validation |
*Token-budget table and strict-compliance loading go here if the repo runs automated ticket-to-change processes.*

## Spec Registry
<!-- Capture: where each standing doc lives so an agent can route to it. Avoid: linking docs that don't exist
     in this repo — drop rows that don't apply. Example: keep DATA_MODEL only if the repo owns data. -->
| Doc | Location | Purpose |
|---|---|---|
| Patterns | `patterns/` (+ `<lang>/`) | repo conventions, correct vs incorrect |
| Rules | `RULES.md` + `rules/` (+ `<language>/`) | enforceable do/don't beyond AGENTS.md critical rules |
| Glossary | `GLOSSARY.md` | ubiquitous language: term → definition → code location |
| Security | `SECURITY.md` | trust boundaries, authn/authz, secret handling, data classification |
| Contracts | `CONTRACTS.md` | root index of public-surface contracts; details live at owning modules or native contract sources |
| Data model | `DATA_MODEL.md` | entities, ownership, relationships, migration discipline (if the repo owns data) |
| Service state | `SERVICE_STATE.md` | living as-built registry — read first to avoid duplicate/breaking surfaces |
| Test index | `TEST_INDEX.md` | test tiers, canonical commands, locations, frameworks, dependencies, and quality gates |
| Getting started | `GETTING_STARTED.md` | clone/build/run + multi-repo workspace layout |
| Decision records | `adr/` | standing ADRs — why the architecture is the way it is |
| Review catalog | `REVIEW_CHECKLIST.md` | the 6-core + 4-coverage + 3-cross-cutting review checks |
