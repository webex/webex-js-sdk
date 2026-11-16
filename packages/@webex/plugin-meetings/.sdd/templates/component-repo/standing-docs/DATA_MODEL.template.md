<!-- ───────────────────────────────
  Template:     Data Model
  Template-ID:  data-model
  Generates:    ai-docs/DATA_MODEL.md
  Description:  Repo-wide entities, system-of-record ownership, relationships, and migration discipline.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Data Model — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc; related: `GLOSSARY.md`, `CONTRACTS.md`, `SECURITY.md`.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc — the repo-wide data model: entities owned, the system-of-record for each, schema/
  relationships, and migration discipline. Only for repos that own persistent data. Headings are flat;
  sections preceded by `<!-- Include if: ... -->` are kept only when the condition holds. Each section
  comment gives Capture / Avoid / Example. Fill from the real schema/migrations (file path).
-->

> Read before changing any persisted shape. Respect ownership and the migration discipline below.

## Entity Catalog
<!-- Capture: each persisted entity → meaning, the owning module (single writer), its table, where defined.
     Avoid: an entity with two writers, or guessing the store. Example: "<Entity> | <domain meaning> | <module>
     | <table> | db/schema.sql." -->
| Entity | What it represents | System-of-record (owning module) | Stored in (table/collection) | Defined at |
|---|---|---|---|---|
| `<entity>` | <meaning> | `<module>` | `<table>` | `<file path>` |

## Relationships
<!-- Capture: how entities relate (1:1/1:N/N:M), ideally a diagram. Avoid: implied relationships with no FK/
     join documented. Example: "<EntityA> 1:N <EntityB> (<entity_b>.<entity_a_id>)." -->
```
<ER-style diagram or relationship list>
```

## Ownership & Access Rules
<!-- Capture: who may write vs read each entity + the access path. Avoid: cross-module direct writes that break
     invariants. Example: "<Entity> | write: <owner module> only | read: <reader module> | via <Repository>." -->
| Entity | May write | May read | Access path (API/repo layer) |
|---|---|---|---|

<!-- Include if: the repo uses caching over its data -->
## Caching
<!-- Capture: each cache over the data — backend, key, TTL, invalidation. Avoid: a cache with no invalidation.
     Example: "<entity-cache> | <cache backend> | <entity>:{id} | 30s | bust on owner write." -->
| Cached data | Backend | Key | TTL | Invalidation trigger |
|---|---|---|---|---|

## Migration Discipline
<!-- Capture: where migrations live, the ordering/expand-contract rule, the never-edit-shipped rule. Avoid:
     destructive in-place migrations. Example: "db/migrations/NNNN_*.sql; expand→migrate→contract; additive first." -->
- Migrations are the source of truth for schema; <where they live + numbering/ordering rule>.
- Backward-compatible by default (expand → migrate → contract); <true-up/backfill expectation>.
- Never edit a shipped migration in place; add a new one.

<!-- Include if: some data is sensitive (PII/secret/regulated) -->
## Sensitive Data
<!-- Capture: which entities hold sensitive data + encryption/retention/deletion per `SECURITY.md`. Avoid:
     storing PII unencrypted or with no retention rule. Example: "Customer.email — encrypted; delete 30d after close." -->
- Classify per `SECURITY.md`; note encryption-at-rest, retention, and deletion obligations per entity.

## Maintenance
<!-- Capture: the rule that keeps this current. Avoid: schema changes without a doc update. -->
- New/changed entity or migration → update this doc in the same change.
- Cross-reference: terms → `GLOSSARY.md`; exposed data contracts → `CONTRACTS.md`.
