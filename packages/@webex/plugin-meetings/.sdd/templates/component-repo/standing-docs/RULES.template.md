<!-- ───────────────────────────────
  Template:     RULES
  Template-ID:  rules
  Generates:    ai-docs/RULES.md
  Description:  Enforceable do/don't beyond AGENTS — coverage, autonomy, naming, logging, errors, testing, security, drift, secrets.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Rules — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry, carries the critical rules) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc; per-language detail in `rules/<language>/`.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc — the enforceable do/don't rules beyond AGENTS.md's few critical ones. Every rule is
  EXTRACTED from this repo's real reviews/conventions (file path), not generic best practice; defer to the
  linter where it already enforces. Headings are flat; sections preceded by `<!-- Include if: ... -->` are
  kept only when the condition holds. Each section comment gives Capture / Avoid / Example.
-->

> These rules are checkable. Every MUST rule records its source requirement/risk, verification path,
> severity, and owner. Name the tool where one enforces a rule; say "review only" plus why otherwise.

## Coverage Map (which docs/specs to trust)
<!-- Capture: per-module coverage state (mirrored from the manifest) + what it implies. Avoid: drifting from the
     manifest. Example: "<module-a>/ manifest state → trust level; <module-b>/ manifest state → code cross-check required." -->
| Module | Manifest coverage state | What it means here |
|---|---|---|
| `<module>` | <from `.sdd/manifest.json`> | <how strongly the spec can be trusted; whether code cross-check is required> |

## Autonomy & Ask-First
<!-- Capture: what may proceed without asking vs needs confirmation vs never-without-approval, for THIS repo.
     Avoid: blanket autonomy on risky changes. Example: "May: a copy tweak. Ask: a schema change. Never: deploy." -->
- **May proceed:** <low-risk changes that don't touch contracts/data/security>
- **Ask first / plan + confirm:** <contract changes, migrations, security surfaces, anything irreversible>
- **Never without explicit human approval:** <push, deploy, delete data, post to trackers/PRs>

## Naming
<!-- Capture: the real conventions for files/types/functions/events, with one example. Avoid: a generic style
     guide. Example: "Events are past-tense PascalCase: `<ResourceCreated>`, not `<createResource>`." -->
- <real naming conventions, from the codebase, with an example>

## Logging
<!-- Capture: levels, structured format, correlation/request id, what must NEVER be logged. Avoid: logging PII/
     secrets. Example: "JSON logs; include request_id; never log card numbers or tokens." -->
- <levels, structured format, correlation id, never-log list (see SECURITY.md)>

## Error Handling
<!-- Capture: the repo's error idiom (exceptions/result types), wrapping/enrichment, user vs internal errors.
     Avoid: swallowing errors or leaking internals to users. Example: "Domain errors are typed Result; map to
     HTTP at the edge; never leak stack traces." -->
- <error idiom + wrapping + user-facing vs internal>

## Imports / Dependencies
<!-- Capture: import ordering/boundaries, allowed layering, how new deps are vetted. Avoid: cross-layer imports
     or unvetted deps. Example: "domain/ must not import api/; new deps need a lead's approval." -->
- <import ordering/boundaries, allowed layering, dep-vetting>

## Testing
<!-- Capture: what each change must add (unit + the fitting higher tier), the positive-AND-negative rule, the
     coverage bar, where tests live. Avoid: only-happy-path tests. Example: "Each behavior gets a passing and a
     must-not-fire test; changed-line coverage ≥ 80%." -->
- <required tests + positive/negative rule + coverage bar + test location>

## Security
<!-- Capture: the repo-specific security must-dos (defer to SECURITY.md for the full posture). Avoid: restating
     all of SECURITY.md. Example: "Validate all input at the edge; authz on every handler; no secrets in code." -->
- <repo-specific must-dos; pointer to SECURITY.md>

## Spec-Currency & Drift Thresholds
<!-- Capture: the same-change spec rule + the drift thresholds per manifest coverage state. Avoid: merging code without updating
     the spec. Example: "manifest state A ≤5% drift; manifest state B ≤15%; manifest state C ≤25%." -->
- Update the spec/docs in the SAME change as the code (spec-currency).
- Drift thresholds: mirror `.sdd/coverage-policy.defaults.yaml` or the repo's stricter manifest policy.

## Secrets Policy
<!-- Capture: where secrets come from + the never-log/never-commit rule. Avoid: any hardcoded secret. Example:
     "Secrets from the manager at boot; CI secret-scans; build fails on a detected secret." -->
- No hardcoded secrets/tokens/keys/connection strings — ever. Source from <secret store>; never log them.

<!-- Include if: the repo is concurrent/async/reactive -->
## Concurrency & Async
<!-- Capture: what must be non-blocking, ordering guarantees, idempotency expectations. Avoid: blocking the
     event loop / assuming single delivery. Example: "Handlers idempotent (keyed by event id); no blocking I/O on the loop." -->
- <threading/reactive rules, ordering, idempotency>

<!-- Include if: the repo runs automated ticket-to-change or strict-compliance processes -->
## Strict-Compliance Mode
<!-- Capture: when blocking gates apply, retry caps, stop-on-violation. Avoid: silent retries past the cap.
     Example: "In auto-runs: stop on first MUST violation; max 3 retries; then escalate." -->
- <when blocking gates apply, retry caps, stop-on-violation behavior>

## Maintenance
- Add a rule when a review correction recurs; remove it when a lint rule starts enforcing it.
- Cross-reference: patterns → `patterns/`; per-language → `rules/<language>/`.
