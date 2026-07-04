# Review-Check Catalog — @webex/calling

## Core checks (always run)

- Build, unit tests, and style checks pass.
- Change follows `RULES.md`; no secrets/sensitive payloads are logged.
- Source behavior, tests, module spec, diagrams, and contracts remain aligned.
- Public changes start at `src/index.ts` and include semver/changelog review.

## Coverage-conditional checks (run by the touched module's manifest coverage state)

- `Partial`: cross-check every relevant claim against source/tests and add characterization coverage before risky behavior changes.
- `Untracked`: code remains source of truth; run `spec-reconcile`/`doc-backfill` before feature modification.
- `Specced`: preserve requirements or record explicit ADDED/MODIFIED/REMOVED deltas.

## Cross-cutting checks (apply at higher risk / autonomy)

- Backend matrix, events, error hierarchy, metrics, retries/timeouts, cleanup, state machines, token handling, and sensitive data.
- Mobius/registration changes cover close codes, refresh, late/duplicate events, failover/failback, and network restoration.

## How the set is selected

Use `.sdd/manifest.json`, `SPEC_INDEX.md`, the owning module profile/spec, and the actual change surface. Add security/contract/performance checks when those concerns are touched.

## Output

Record commands run, results, impacted specs/contracts, unresolved findings, and validator handoff in the change or run record.
