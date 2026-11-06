---
type: ADR
title: ADR-0001 - Trial a candidate CA-root bundle in report-only mode
description: A candidate KMS CA-root bundle is checked in the background and reported through metrics, independently of the enforced roots, so a new bundle can be evaluated without risking ECDH setup failures.
tags: [adr]
timestamp: 2026-11-05T00:00:00Z
status: proposed
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-05T12:32:04Z
validation_status: pass
-->

# ADR-0001 - Trial a candidate CA-root bundle in report-only mode

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Status        | Proposed                                                                               |
| Decision date | 2026-11-05 (recorded; the decision itself is already implemented in code)              |
| Deciders      | Not recorded in the repository               |
| Supersedes    | N/A                                                                                    |
| Superseded by | N/A                                                                                    |

## Context

When `shouldValidateKMSCertificate` is enabled, the KMS certificate chain must validate against the enforced CA roots
or key negotiation fails closed (`docs/architecture.md`, Security). Changing the trusted root bundle therefore risks
failing every ECDH negotiation. The rationale below comes only from code comments in `src/config.js` and the package
`README.md`; no ticket, incident, or design document is in the repository, and the owners were asked only to select
this decision for recording.

## Decision

A second, independent check against a candidate root set runs in report-only mode:

- `reportOnlyAssetsBaseUrl` (default `undefined`) selects a separate directory serving the same `carootsAsset`
  filename. Supplying it enables a background check in both browsers and Node; omitted, `null`, and empty-string
  values disable it. It works with enforcement enabled or disabled.
- It runs after mandatory and enforced key validation succeed. Its download, bundle-verification, and chain failures
  are reported as metrics tagged `validationMode: 'report-only'` and never delay or reject setup.
- `carootsReportOnly` (an explicit array) keeps its earlier behavior: it is awaited, failures report a metric without
  rejecting setup, and a truthy value (including an empty array) takes precedence over `reportOnlyAssetsBaseUrl`.
- No separate report-only boolean exists; supplying the URL is the switch.

Evidence: `src/config.js` (`reportOnlyAssetsBaseUrl`, `carootsReportOnly`), `README.md` (KMS certificate
validation).

## Why

Per the README, the trial lets a new signed bundle be evaluated against real traffic without the possibility of a
total ECDH failure, because only enforced results can reject setup. Keeping the legacy array path unchanged preserves
existing callers' selection and timing behavior. Reasons beyond these comments are not recorded.

## Alternatives considered

| Alternative                                         | Why it was not selected                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Add a report-only boolean flag                      | README: "No additional report-only boolean is needed"; supplying the URL enables the check.             |
| Change the legacy `carootsReportOnly` array behavior | README: existing callers retain their array selection and timing, so it was kept as is.                  |
| Swap the enforced bundle directly                   | Not stated in the repository; the report-only path exists so a bundle can be evaluated without enforcement risk. |

## Consequences

**Positive:**

- A candidate bundle can be evaluated through metrics with no effect on setup.
- Existing `carootsReportOnly` callers are unaffected.

**Negative / tradeoffs:**

- Two validation paths and extra metrics (`docs/architecture.md`, trade-offs).
- A tab or SDK instance closing can prevent a late background report from completing (README).

## Constraint on future changes

A report-only failure must never reject or delay setup, and `carootsReportOnly` array semantics (awaited, truthy
precedence) must stay compatible while this decision is active.

## Follow-up

- [ ] Owners may record the deciders and original motivation if a source is found.

## Revisit when

- The repository defines no end condition for the trial; revisit if the candidate bundle becomes the enforced one or the report-only option is removed.

## References

- `src/config.js`, `README.md`, `src/docs/README.md` (trade-off table)
