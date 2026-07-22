# Review-Check Catalog — @webex/contact-center

> Run by a runtime different from the generator. Findings remain drafts until explicitly published.

## Core checks (always run)

| # | Check | What it verifies | Severity if it fails |
|---|---|---|---|
| C1 | Spec-currency + WHAT/WHY | Specs/docs and code land together; every requirement states WHAT and WHY | Blocking |
| C2 | Contract correctness | Provides/Requires and public API/event/type deltas are complete | Blocking |
| C3 | Code-vs-spec match | Signatures, flows, states, timeouts, and architecture match code | Blocking |
| C4 | Test adequacy | Positive/negative cases and 85% package threshold | Important |
| C5 | Error handling/input validation | Structured failures, tracking ids, validation, no swallowed errors | Important |
| C6 | Security baseline | Host auth, no secrets/sensitive logs, safe transport mapping | Blocking |

## Coverage-conditional checks (run by the touched module's manifest coverage state)

| # | Check | When it applies | What it verifies | Severity |
|---|---|---|---|---|
| K1 | Regression guard | Partial module or modified/removed guarantee | Characterization and invariants | Blocking |
| K2 | Grounding | Partial module | Stable file-path evidence; code cross-check | Important |
| K3 | Drift threshold | Any tracked module | Drift remains within policy | Important |
| K4 | Coverage-state accuracy | Promotion/demotion | Status matches evidence | Medium |

## Cross-cutting checks

| # | Check | What it verifies | Severity |
|---|---|---|---|
| X1 | Cross-runtime review | Validator differs from Codex generator | Blocking |
| X2 | Observability | LoggerProxy/metrics adequate; no sensitive logging | Medium |
| X3 | Rollout safety | Defaults, compatibility, rollback/recovery safe | Important |

## How the set is selected

1. Run all six core checks.
2. Add K1–K4 for current Partial modules.
3. Add X1–X3 for high-risk, contract, security, state, transport, or autonomous changes.

## Output

- Compliance matrix, severity-sorted findings, and Pass / Pass-with-warnings / Blocked verdict. Draft only.
