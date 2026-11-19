<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:23:21Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Standing, append-only record of **why** the architecture is the way it is — including the options that
were rejected. ADRs live with the repo forever, so an agent sees the reasoning behind a constraint
instead of "fixing" it by accident. The module specifications own current behavior; an ADR owns why a
structural or documentation choice was made.

Use ADRs for durable architecture decisions that constrain future work. Do not use ADRs for run
notes, temporary investigation findings, or per-feature task history.

- **Fill-in shape:** the repo-standards ADR template kept under the monorepo root `.sdd/templates/repo-standards/docs/adr/` (Context · Decision · Why · Alternatives considered · Consequences · Constraint on future changes · Follow-up · Revisit when · References).
- **Numbering:** one file per decision, `NNNN-short-title.md` (zero-padded, monotonic).
- **Immutability:** ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one (and set the old one's status to `Superseded by NNNN`).
- Reference ADRs from the [package architecture](../architecture.md) and module specs where a decision constrains the design.

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-migrate-ai-docs-to-repo-standards.md) | Migrate the legacy AI documentation into the repo-standards layout | Accepted |

Keep this list in numeric order.
