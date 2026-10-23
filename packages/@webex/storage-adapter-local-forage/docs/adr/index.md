<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T11:32:37Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting `@webex/storage-adapter-local-forage`
and its documentation. Add a concrete ADR (for example, `0001-scope-clear-to-namespace.md`) when a
decision is non-obvious, hard to reverse, or worth explaining to a future contributor. Do not edit an
accepted decision in place when its outcome changes; supersede it with a new ADR and link both
records.

## Index

No architectural decisions are registered yet. The current design choices are the shared default
`localforage` database, the `keys()` scan used to tell a stored `null` from a missing key, and
`oneFlight` on reads and deletes. They are recorded with their costs in the module specification's
[Key design trade-off](../../src/docs/README.md#key-design-trade-off) section. On 2026-10-06 the owner
classified the whole-database `clear()` and the ignored constructor argument as known hazards to fix
separately, so a fix to either should arrive with a concrete ADR.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and the condition that would
cause the team to revisit it. Record the deciders, any superseded decision, and the constraint future
changes must preserve.
