<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-07T13:20:21Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting `@webex/webex-core` and its
documentation. Add a concrete ADR (for example, `0001-some-decision.md`) when a decision is
non-obvious, hard to reverse, or worth explaining to a future contributor. Do not edit an accepted
decision in place when its outcome changes; supersede it with a new ADR and link both records.

## Index

No architectural decisions are registered yet.

The package does carry design decisions worth preserving — services and credentials living inside core
rather than as outside plugins (stated in the header comment of [`src/index.js`](../../src/index.js)), a
process-global plugin registry, and parallel v1 and v2 service discovery. They are recorded in the
module specifications' trade-off sections rather than as ADRs, because the code does not identify the
deciders or decision dates an ADR record requires. Promote any of them to a numbered ADR once that
provenance is established.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and the condition that would
cause the team to revisit it. Record the deciders, any superseded decision, and the constraint future
changes must preserve.
