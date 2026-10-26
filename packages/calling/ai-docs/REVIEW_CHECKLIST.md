# Review-Check Catalog — @webex/calling

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc at Review & Merge.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

> Each finding records: severity (Blocking / Important / Medium / Minor), check id, file path, what's wrong,
> why it matters, a concrete fix. Any Blocking finding fails the gate.

## Core checks (always run)

| # | Check | What it verifies | Severity if it fails |
|---|---|---|---|
| C1 | Spec-currency + WHAT/WHY | Spec/docs changed in the same change as code; the implementation plan's repo-specific AI Docs Impact matrix entries are complete and closed; every requirement (incl. ADDED) states WHAT and WHY | Blocking |
| C2 | Contract correctness | Provides/Requires delta is real and complete; no undocumented breaking change to a public surface | Blocking |
| C3 | Code-vs-spec match | Signatures, data-flow, and architecture claims in the spec match the actual code (file path) | Blocking |
| C4 | Test adequacy | Each acceptance criterion has a test with a positive AND a negative case; changed-line coverage meets the bar | Important |
| C5 | Error handling + input validation | Untrusted input validated at boundaries; failure/edge paths handled, not swallowed | Important |
| C6 | Security baseline | No hardcoded secrets; authz enforced; data-classification/logging rules respected (per `SECURITY.md`) | Blocking |

## Coverage-conditional checks (run by the touched module's manifest coverage state)

| # | Check | When it applies | What it verifies | Severity |
|---|---|---|---|---|
| K1 | Regression guard | Modifying a weakly covered module, or any MODIFIED/REMOVED requirement | A characterization baseline exists; invariants the change claims NOT to alter still hold (positive + negative) | Blocking |
| K2 | Grounding | Weakly covered module | Claims cite real code (file path), not memory; uncovered public surfaces are explicitly marked as unresolved for human input | Important |
| K3 | Drift threshold | Any tracked module | Module drift is within its status threshold (see `RULES.md` / `coverage-policy.defaults.yaml`) | Important |
| K4 | Coverage-state accuracy | Coverage-state change proposed | The recorded manifest coverage state matches the evidence; promotion/demotion rules honored | Medium |

## Cross-cutting checks (apply at higher risk / autonomy)

| # | Check | What it verifies | Severity |
|---|---|---|---|
| X1 | Cross-model review | The artifact was validated by a different runtime than the one that generated it (generator ≠ validator) | Blocking when required |
| X2 | Observability | Logs/metrics/alerts adequate for the change; nothing sensitive logged | Medium |
| X3 | Rollout safety | Feature-flag default is safe; rollback path exists; migration/rollout interlock is correct | Important |

## How the set is selected

1. Always run the 6 core checks.
2. Add the coverage-conditional checks whose "when it applies" matches the touched modules' manifest coverage state.
3. Add the cross-cutting checks when the change is high-risk or runs at higher autonomy.

## Output

- A compliance matrix + severity-sorted findings + a verdict (Pass / Pass-with-warnings / Blocked).
  Draft only; a human posts.
