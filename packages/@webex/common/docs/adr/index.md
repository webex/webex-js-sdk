<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-21T08:58:59Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting `@webex/common` and its
documentation. Add a concrete ADR (for example, `0042-cache-policy.md`) when a decision is
non-obvious, hard to reverse, or worth explaining to a future contributor. Do not edit an accepted
decision in place when its outcome changes; supersede it with a new ADR and link both records.

## Index

No architectural decisions are registered yet. Replace this sentence with links to concrete,
accepted ADRs as decisions are recorded.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and the condition that
would cause the team to revisit it. Record the deciders, any superseded decision, and the constraint
future changes must preserve.

Two long-standing constraints are described in [architecture.md](../architecture.md) but have **no**
recorded ADR, because no decision record was found in the repository and commit history was ruled
out as an evidence source during onboarding:

- the no-runtime-Webex-dependency inclusion rule;
- the frozen, unversioned Hydra identifier encoding.

Both are candidates for a retrospective ADR by their owners.
