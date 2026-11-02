<!-- ───────────────────────────────
  Template:     Security Baseline
  Template-ID:  security
  Generates:    ai-docs/SECURITY.md
  Description:  Standing security posture — trust boundaries, authn/authz, secret handling, data classification.
  Library ver:  0.2.2
  Last updated: 2026-07-11
─────────────────────────────── -->

# Security Baseline — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc; module-specific security behavior lives in each owning module spec.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc — the security posture an agent must respect on EVERY change (distinct from a
  change-specific threat review). Document what the repo ACTUALLY enforces today (file path), not aspirations;
  mark gaps `[NEEDS HUMAN INPUT]`. Headings are flat; sections preceded by `<!-- Include if: ... -->` are
  kept only when the condition holds. Each section comment gives Capture / Avoid / Example.
-->

> Read before changing anything that touches input, identity, data, or external calls. Don't weaken a
> documented control without an explicit, approved decision (record it as an ADR).

## Trust Boundaries
<!-- Capture: each point where untrusted input crosses in, and what's enforced at the crossing. Avoid: assuming
     internal == trusted. Example: "Public API edge | internet caller | service | JWT verify + schema validate." -->
| Boundary | Untrusted side | Trusted side | What is enforced at the crossing |
|---|---|---|---|
| <e.g. public API edge> | <caller> | <service> | <authn, input validation, rate limit> |

## Authentication & Authorization Model
<!-- Capture: how identity is established and how access decisions are made, each with where enforced (file path).
     Avoid: per-endpoint ad-hoc checks with no central model. Example: "JWT verified in middleware/auth.ts;
     RBAC checked in each handler via requireRole()." -->
- **Authentication:** <mechanism + where verified> (`<file path>`)
- **Authorization:** <model (RBAC/ABAC/ownership) + where enforced> (`<file path>`)
- **Default posture:** <deny-by-default? where the default lives>

## Secret & Credential Handling
<!-- Capture: where secrets come from, how they're injected, rotation policy. Avoid: secrets in code/env files/
     logs. Example: "From the secret manager at boot; never in source; rotated 90d." -->
- Secrets source: <vault / KMS / secret store — never source code>
- Injection: <how the running code obtains them>
- Rotation: <policy, or `[NEEDS HUMAN INPUT]`>
- **Hard rule:** never commit secrets, tokens, keys, or connection strings; never log them.

## Data Classification & Handling
<!-- Capture: the data classes handled + the storage/logging/transit rule per class. Avoid: logging PII or
     storing it unencrypted. Example: "PII (email) | encrypted at rest | never logged | TLS in transit." -->
| Data class | Examples | Storage rule | Logging rule | In transit |
|---|---|---|---|---|
| <e.g. PII> | <fields> | <encrypted at rest?> | <never log / masked> | <TLS> |

## Input Validation & Output Encoding Posture
<!-- Capture: the repo-wide expectation for untrusted input and rendered/serialized output. Avoid: trusting
     client input or string-concatenating queries. Example: "Validate at the boundary (allow-list); parameterize
     all SQL; encode output for its sink." -->
- Validate at the boundary (allow-list where possible); parameterize queries/commands; encode output for its sink.

<!-- Include if: the repo exposes a network/HTTP API or web surface -->
## Transport & Headers
<!-- Capture: TLS, security headers, CORS/CSRF posture (file path). Avoid: permissive CORS (*) on authed routes.
     Example: "HTTPS only + HSTS; CORS allow-list in config/cors.ts; CSRF tokens on state-changing routes." -->
- HTTPS/TLS everywhere; relevant security headers; CORS/CSRF posture (`<file path>`).

<!-- Include if: the repo handles sessions or cookies -->
## Session & Cookie Posture
<!-- Capture: session id generation, cookie flags, timeout/rotation. Avoid: tokens in localStorage; missing
     HttpOnly. Example: "CSPRNG id; Secure+HttpOnly+SameSite=Strict; rotate on login; 30m idle timeout." -->
- Session id generation, cookie flags (Secure/HttpOnly/SameSite), timeout/rotation policy.

<!-- Include if: the repo has known security-sensitive areas or accepted risks -->
## Known Sensitive Areas & Accepted Risks
<!-- Capture: each sensitive area, its risk, the mitigation/why-accepted, the owner. Avoid: an undocumented
     accepted risk. Example: "Legacy import endpoint | no rate limit | behind VPN only | @platform." -->
| Area | Risk | Mitigation / why accepted | Owner |
|---|---|---|---|

## Reporting & Review
<!-- Capture: who reviews security changes + where to report vulnerabilities. Avoid: no defined path. -->
- Security-relevant changes require <review path>. Suspected vulnerabilities: <where to report>.
- Cross-reference: module-specific security behavior lives in the owning module spec and native
  threat-model or security-review source when one exists.
