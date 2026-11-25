<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-28T05:34:36Z
validation_status: pass
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting `@webex/common-timers` and its
documentation. Add a concrete ADR (for example, `0001-some-decision.md`) when a decision is
non-obvious, hard to reverse, or worth explaining to a future contributor. Do not edit an accepted
decision in place when its outcome changes; supersede it with a new ADR and link both records.

## Index

No architectural decisions are registered yet. Replace this sentence with links to concrete,
accepted ADRs as decisions are recorded.

The package does carry design decisions worth preserving — unref-ing every timer unconditionally,
feature-detecting `unref` on the handle instead of branching on the platform, and making `Timer`
throw on an invalid transition rather than ignoring it. They are recorded in the module
specification's [`Key design trade-off`](../../src/docs/README.md#key-design-trade-off) section
rather than as ADRs, because the package's commit history does not identify the deciders or decision
dates an ADR record requires. Promote any of them to a numbered ADR once that provenance is
established.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and the condition that would
cause the team to revisit it. Record the deciders, any superseded decision, and the constraint future
changes must preserve.
