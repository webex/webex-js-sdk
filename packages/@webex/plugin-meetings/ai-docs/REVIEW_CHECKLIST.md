<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: review-checklist@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# REVIEW CHECKLIST — @webex/plugin-meetings

## Core checks (always run)

- [ ] Change scope matches the approved plan and the owning module spec was loaded.
- [ ] Current code and mirrored tests support every behavioral claim; commit/PR history was not used for current behavior.
- [ ] Public exports, methods, events, constants, error shapes, and async timing are preserved or explicitly approved.
- [ ] Positive, negative, cleanup, and rejection paths have focused tests using existing Sinon/assertion conventions.
- [ ] No `.only`, secret, token, participant PII, transcript/media content, or sensitive URL was committed/logged.
- [ ] Build/lint/focused tests were run and their actual result reported.
- [ ] Canonical specs changed in the same merge when behavior/contracts changed.

## Coverage-conditional checks (run by the touched module's manifest coverage state)

- **Specced:** validate implementation and tests against the authoritative spec; any drift blocks.
- **Partial:** treat the spec as a guide and cross-check each affected behavior in source/tests.
- **Untracked:** code is authoritative; obtain approval and establish characterization coverage before risky modification.
- Public/security/performance changes require explicit human approval even when a module is Specced.

## Cross-cutting checks (apply at higher risk / autonomy)

- [ ] Locus full/delta/hash-tree paths remain convergent and ordering assumptions are tested.
- [ ] Timers, queues, media objects, data channels, and event listeners are cleaned up.
- [ ] Request retries are bounded and do not hide terminal server errors.
- [ ] Capability/role/policy gates remain enforced before privileged meeting operations.
- [ ] Source and `test/unit/spec/` paths remain mirrored; target values are relative to the spec root.
- [ ] Metric/log changes reuse existing helpers and redact sensitive values.
- [ ] Dependency and package-export changes follow workspace and semver rules.

## How the set is selected

Core checks always apply. Add state/event checks for `meetings`, `meeting`, `locus-info`, `hashTree`, `members`, and feature modules; media/retry checks for media-path modules; security checks for interceptors, identity, AI, transcript, and participant changes; and public-contract checks for `src/index.ts` or exported objects.

## Output

A review should report affected modules, manifest trust state, tests/checks run, contract/security findings, spec delta, and any unresolved blocker. Draft validation/coverage findings remain local until the user approves publication.
