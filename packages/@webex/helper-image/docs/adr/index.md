<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-opus-5
approved_by: rarajes2@cisco.com
updated_at: 2026-09-28T14:57:53Z
validation_status: pass-with-warnings
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting this repository
and its documentation. Add a concrete ADR (for example, `0042-cache-policy.md`) when a decision
is non-obvious, hard to reverse, or worth explaining to a future contributor.
Do not edit an accepted decision in place when its outcome changes; supersede it
with a new ADR and link both records.

## Index

No architectural decisions are registered yet. Replace this sentence with links to concrete,
accepted ADRs as decisions are recorded.

Two standing design choices in this package are candidates for the first ADRs, because both are
consumer-visible and neither carries a recorded rationale in the code: the split of `processImage`
into separate Node and browser implementations selected by the `browser` field in `package.json`,
and the decision that a missing host image toolchain degrades to an undefined result rather than a
rejection. Both are described with evidence in [`../../src/docs/README.md`](../../src/docs/README.md)
under `Key design trade-off`; neither has been ratified as a decision record.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and
the condition that would cause the team to revisit it. Record the deciders,
any superseded decision, and the constraint future changes must preserve.
