<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-05T12:32:04Z
validation_status: pass
-->

# Architectural decision records

Numbered, append-only records of structural decisions affecting this package
and its documentation. Add a concrete ADR (for example, `0001-report-only-ca-root-trial.md`) when a decision
is non-obvious, hard to reverse, or worth explaining to a future contributor.
Do not edit an accepted decision in place when its outcome changes; supersede it
with a new ADR and link both records.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-report-only-ca-root-trial.md) | Trial a candidate CA-root bundle in report-only mode | Proposed |

Other decisions that the code implies but no record explains (request batching with a separate asynchronous response
channel, the `@oneFlight` key fetch, and keeping the KMS-details promise cached after a failure) have only code
comments as rationale. The owner chose to record only the report-only CA-root trial (2026-11-05); no ADRs were
written for the others.

Add new entries as ADRs are accepted. Keep this list in numeric order.

Each ADR should state its context, decision, alternatives, consequences, and
the condition that would cause the team to revisit it. Record the deciders,
any superseded decision, and the constraint future changes must preserve.
