<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:03:58Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Use this append-only directory for numbered records of durable decisions that constrain future Contact
Center SDK work and its documentation.
Add a concrete ADR (for example, `0042-cache-policy.md`) when a decision is non-obvious, hard to
reverse, or worth explaining to a future contributor. Do not edit an accepted decision in place when
its outcome changes; supersede it with a new ADR and link both records.

- One decision per `NNNN-short-title.md` file in this folder, started from the repo-standards ADR
  template under the monorepo root `.sdd/templates/repo-standards/docs/adr/`.
- Link ADRs from the affected module specs and the [package architecture](../architecture.md).

## Index

- [ADR-0001 - Spec source policy](0001-spec-source-policy.md) — accepted 2026-07-07; superseded by
  ADR-0003
- [ADR-0002 - Consult and transfer list policy](0002-consult-transfer-list-policy.md) — accepted
  2026-08-19
- [ADR-0003 - Repo-standards migration](0003-repo-standards-migration.md) — accepted 2026-11-16;
  supersedes ADR-0001

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and the condition that would
cause the team to revisit it. Record the deciders, any superseded decision, and the constraint future
changes must preserve.
