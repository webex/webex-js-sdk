<!-- ───────────────────────────────
  Template:     Review-Check Catalog
  Template-ID:  review-checklist
  Generates:    ai-docs/REVIEW_CHECKLIST.md
  Description:  The review checks — 6 core + 4 coverage-conditional + 3 cross-cutting — selected by manifest coverage state.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Review-Check Catalog — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc at Review & Merge.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING checklist the repo's change reviews run against (Review & Merge). 6 core (always) + 4
  coverage-conditional (by the touched module's manifest coverage state) + 3 cross-cutting (higher risk). Run by a
  DIFFERENT runtime than the generator; findings remain review artifacts until explicitly approved for
  publication. Headings are flat. Each section comment gives Capture / Avoid / Example.
-->

> Each finding records: severity (Blocking / Important / Medium / Minor), check id, file path, what's wrong,
> why it matters, a concrete fix. Any Blocking finding fails the gate.

## Core checks (always run)
<!-- Capture: run all six on every change; record a finding per failure with file path + a concrete fix. Avoid:
     vague findings ("improve error handling"). Example: "C3 fail — spec says verifier 43-128, code enforces
     32-128 @auth.ts." -->
| # | Check | What it verifies | Severity if it fails |
|---|---|---|---|
| C1 | Spec-currency + WHAT/WHY | Spec/docs changed in the same change as code; the implementation plan's repo-specific AI Docs Impact matrix entries are complete and closed; every requirement (incl. ADDED) states WHAT and WHY | Blocking |
| C2 | Contract correctness | Provides/Requires delta is real and complete; no undocumented breaking change to a public surface | Blocking |
| C3 | Code-vs-spec match | Signatures, data-flow, and architecture claims in the spec match the actual code (file path) | Blocking |
| C4 | Test adequacy | Each acceptance criterion has a test with a positive AND a negative case; changed-line coverage meets the bar | Important |
| C5 | Error handling + input validation | Untrusted input validated at boundaries; failure/edge paths handled, not swallowed | Important |
| C6 | Security baseline | No hardcoded secrets; authz enforced; data-classification/logging rules respected (per `SECURITY.md`) | Blocking |

## Coverage-conditional checks (run by the touched module's manifest coverage state)
<!-- Capture: add these when the manifest coverage state requires code cross-check or characterization
     (or a guarantee is removed/modified). Avoid: skipping the regression guard when changing a weakly covered module. Example: "K1 applies — no characterization
     baseline exists → Blocking until one is added." -->
| # | Check | When it applies | What it verifies | Severity |
|---|---|---|---|---|
| K1 | Regression guard | Modifying a weakly covered module, or any MODIFIED/REMOVED requirement | A characterization baseline exists; invariants the change claims NOT to alter still hold (positive + negative) | Blocking |
| K2 | Grounding | Weakly covered module | Claims cite real code (file path), not memory; uncovered public surfaces flagged `[NEEDS HUMAN INPUT]` | Important |
| K3 | Drift threshold | Any tracked module | Module drift is within its status threshold (see `RULES.md` / `coverage-policy.defaults.yaml`) | Important |
| K4 | Coverage-state accuracy | Coverage-state change proposed | The recorded manifest coverage state matches the evidence; promotion/demotion rules honored | Medium |

## Cross-cutting checks (apply at higher risk / autonomy)
<!-- Capture: add these for high-risk or higher-autonomy changes. Avoid: merging an autonomous change that the
     generator also validated. Example: "X1 — validator ran on the same runtime as the generator → Blocking." -->
| # | Check | What it verifies | Severity |
|---|---|---|---|
| X1 | Cross-model review | The artifact was validated by a different runtime than the one that generated it (generator ≠ validator) | Blocking when required |
| X2 | Observability | Logs/metrics/alerts adequate for the change; nothing sensitive logged | Medium |
| X3 | Rollout safety | Feature-flag default is safe; rollback path exists; migration/rollout interlock is correct | Important |

## How the set is selected
<!-- Capture: 6 core always + the coverage-conditional checks matching the touched modules' manifest coverage state + cross-cutting
     for high-risk. Avoid: running only the core set on a risky migration. -->
1. Always run the 6 core checks.
2. Add the coverage-conditional checks whose "when it applies" matches the touched modules' manifest coverage state.
3. Add the cross-cutting checks when the change is high-risk or runs at higher autonomy.

## Output
<!-- Capture: a compliance matrix (check → pass/warn/fail w/ file path) + severity-sorted findings + verdict;
     draft only. Avoid: auto-posting to the PR. Example: verdict "Blocked — 1 Blocking (C3)". -->
- A compliance matrix + severity-sorted findings + a verdict (Pass / Pass-with-warnings / Blocked).
  Draft only; a human posts.
