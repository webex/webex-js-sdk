# Spec Index — @webex/calling

> Start with [AGENTS.md](../AGENTS.md). Coverage state is authoritative in `../.sdd/manifest.json`.

## Module Registry

| Module | Source | Canonical spec | Status |
|---|---|---|---|
| CallHistory | `src/CallHistory/` | [call-history-spec.md](../src/CallHistory/ai-docs/call-history-spec.md) | Partial |
| CallRecording | `src/CallRecording/` | [call-recording-spec.md](../src/CallRecording/ai-docs/call-recording-spec.md) | Partial |
| CallSettings | `src/CallSettings/` | [call-settings-spec.md](../src/CallSettings/ai-docs/call-settings-spec.md) | Partial |
| CallingClient | `src/CallingClient/` | [calling-client-spec.md](../src/CallingClient/ai-docs/calling-client-spec.md) | Partial |
| Calling | `src/CallingClient/calling/` | [calling-spec.md](../src/CallingClient/calling/ai-docs/calling-spec.md) | Partial |
| CallerId | `src/CallingClient/calling/CallerId/` | [caller-id-spec.md](../src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md) | Partial |
| Line | `src/CallingClient/line/` | [line-spec.md](../src/CallingClient/line/ai-docs/line-spec.md) | Partial |
| Registration | `src/CallingClient/registration/` | [registration-spec.md](../src/CallingClient/registration/ai-docs/registration-spec.md) | Partial |
| Contacts | `src/Contacts/` | [contacts-spec.md](../src/Contacts/ai-docs/contacts-spec.md) | Partial |
| Metrics | `src/Metrics/` | [metrics-spec.md](../src/Metrics/ai-docs/metrics-spec.md) | Partial |
| Voicemail | `src/Voicemail/` | [voicemail-spec.md](../src/Voicemail/ai-docs/voicemail-spec.md) | Partial |
| Mobius socket | `src/mobius-socket/` | [mobius-socket-spec.md](../src/mobius-socket/ai-docs/mobius-socket-spec.md) | Partial |

All 12 specs passed independent Claude Code validation on 2026-07-04 with zero Blocking findings. `Partial` remains the governance status until promotion/churn criteria are separately reviewed; it no longer indicates a missing validation run.

## Task Routing

| Change | Read first |
|---|---|
| Package export, factory, or type | [CONTRACTS.md](CONTRACTS.md), then owning module spec |
| Call lifecycle/media/transfer | Calling spec, then CallingClient spec |
| Registration/recovery | Registration spec, then Line and CallingClient specs |
| Backend settings/voicemail | Owning module spec and backend connector source |
| WebSocket signaling | Mobius socket spec and Calling spec |
| Cross-cutting logging/events/errors/metrics | [RULES.md](RULES.md), relevant pattern, owning module spec |

## Intake Routing

- New feature or bug: run the SDLC lifecycle and identify impacted modules from this registry.
- Existing-module documentation gap: run `doc-backfill` only after `spec-reconcile`.
- Public contract change: update `CONTRACTS.md`, owning module spec, export/type source, tests, and changelog together.

## Incident History

No canonical incident registry is present. Use trusted package PR/commit history and `CHANGELOG.md` as supporting evidence; current code and tests remain authoritative.

## Phase-Based Loading Protocol

1. Load `AGENTS.md` and this index.
2. Load `ARCHITECTURE.md` and `CONTRACTS.md` for cross-module or public-surface work.
3. Load only impacted module specs.
4. Load `RULES.md`, patterns, security, service state, and legacy source docs when the change requires them.

## Spec Registry

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Package-wide component and interaction architecture |
| [CONTRACTS.md](CONTRACTS.md) | Consumer exports, events, and external dependencies |
| [RULES.md](RULES.md) | Enforceable repository conventions |
| [SECURITY.md](SECURITY.md) | Trust boundaries and sensitive-data handling |
| [SERVICE_STATE.md](SERVICE_STATE.md) | Living endpoints, events, dependencies, metrics, and flags |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Package setup and verification |
| [GLOSSARY.md](GLOSSARY.md) | Calling-domain terminology |
| [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) | Coverage-aware review catalog |
| `patterns/` | Source-grounded implementation patterns |
| `adr/` | Architecture decisions created through review |
