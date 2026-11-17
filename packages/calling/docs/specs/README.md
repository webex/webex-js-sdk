---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:02:22Z
validation_status: blocked
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
and native contract. Keep technical facts in the owning document; this page only routes. This router
mirrors `.sdd/manifest.json`; load only the docs needed for the task.

Start with the [package architecture](../architecture.md). No service specification exists: this
package is a library published to npm, so that artifact is omitted in `.sdd/manifest.json`.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package/component ownership and interaction, resource inventory, dependency topology, contract index (export, event, and dependency catalog), security trust boundaries and sensitive-data rules, current events, dependencies, flags, and metrics, and calling-domain language |
| Service specification | Not applicable — no deployable service exists in this package |
| Module specifications | Stable behavior and design in the manifest-routed `docs/README.md` beside each module's code, listed in the Module registry |
| [Agent instructions](../../AGENTS.md) | Enforceable package rules, code-grounded implementation conventions, the review checklist, and the change workflow |
| [Getting started](../getting-started.md) | Install/build/test loop |
| [ADR](../adr/index.md) | Durable architecture rationale: a decision, its deciders, rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Active | 2026-11-16 |
| Package | Agent entry | `AGENTS.md` | @webex/web-sdk | Active | 2026-11-16 |
| 13 modules | Module | listed in the Module registry below | @webex/web-sdk | Active | 2026-11-16 |
| `calling-client-sdk`, `line-sdk`, `call-sdk`, `call-history-sdk`, `call-recording-sdk`, `call-settings-sdk`, `contacts-sdk`, `voicemail-sdk`, `sdk-connector-sdk` | Contract (published) | `package.json` | @webex/web-sdk | Active | 2026-11-16 |
| `registration-internal`, `caller-id-internal`, `metrics-internal`, `sdk-connector-internal`, `mobius-socket-internal` | Contract (internal) | each module's `types.ts`, indexed in the architecture | @webex/web-sdk | Active | 2026-11-16 |

No repository-local incident/RCA index was found under `packages/calling/`. Add references here when an authoritative incident source is supplied.

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
|---|---|---|---|
| `src/CallHistory/` | createCallHistoryClient(webex, logger) -> ICallHistory | Partial | `src/CallHistory/docs/README.md` |
| `src/CallRecording/` | createCallRecordingClient(webex, logger) -> ICallRecording | Partial | `src/CallRecording/docs/README.md` |
| `src/CallSettings/` | createCallSettingsClient(webex, logger) -> ICallSettings | Partial | `src/CallSettings/docs/README.md` |
| `src/CallingClient/` | async createClient(webex, config?) resolves an ICallingClient | Partial | `src/CallingClient/docs/README.md` |
| ↳ `src/CallingClient/calling/` | ICall and CallManager call lifecycle operations | Partial | `src/CallingClient/calling/docs/README.md` |
| ↳ ↳ `src/CallingClient/calling/CallerId/` | Caller identity resolution and incremental display-information callbacks | Partial | `src/CallingClient/calling/CallerId/docs/README.md` |
| ↳ `src/CallingClient/line/` | ILine call and registration operations | Partial | `src/CallingClient/line/docs/README.md` |
| ↳ `src/CallingClient/registration/` | Internal registration, deregistration, failover, failback, and keepalive lifecycle | Partial | `src/CallingClient/registration/docs/README.md` |
| `src/Contacts/` | createContactsClient(webex, logger) -> IContacts | Partial | `src/Contacts/docs/README.md` |
| `src/Metrics/` | MetricManager singleton and typed calling metric submission methods | Partial | `src/Metrics/docs/README.md` |
| `src/SDKConnector/` | Singleton adapter for Webex SDK request, service, credential, device, and Mercury access | Untracked | `src/SDKConnector/docs/README.md` |
| `src/Voicemail/` | createVoicemailClient(webex, logger) -> IVoicemail | Partial | `src/Voicemail/docs/README.md` |
| `src/mobius-socket/` | MobiusSocket singleton request/response API | Partial | `src/mobius-socket/docs/README.md` |

Coverage states are the manifest values carried over from the previous assessment. Coverage
measurement for the migrated specifications is pending. Independent validation ran in a different runtime
on 2026-11-17 and is blocked by two Blocking findings; see the local validation report.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn test:unit` and `yarn test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| A stable code or component boundary inside one module | Its module spec from the Module registry | `yarn test:unit` |
| A public API/event exported from `src/index.ts` or `src/api.ts` | The architecture contract index, the owning module spec, and the package agent rules | `yarn build:src`, `yarn docs`, and `yarn test:unit` |
| Security, identity, or data handling | The architecture security sections and the owning module spec | `yarn test:unit` plus human review |
| An implementation pattern or coding rule | The package agent instructions | `yarn test:style` |

| Phase | Load |
|---|---|
| Orient | `AGENTS.md` + this file |
| Specify | relevant module spec + questionnaire/intake record |
| Build | selected module spec + the rules and conventions in `AGENTS.md` |
| Verify | conformance, coverage, and independent validation evidence |

Intake routing: new feature or defect -> lifecycle intake questionnaire; new module/component ->
confirm module boundary, then spec + intake; documentation/spec backfill -> reconcile target,
generate, run conformance; public/security/perf change -> explicit plan and human approval before
implementation.

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json` (the module's own `docs/README.md`). Register every module and submodule in the
Module registry above in manifest tree order: `src/CallingClient` owns the child modules
`src/CallingClient/calling` (which owns `src/CallingClient/calling/CallerId`),
`src/CallingClient/line`, and `src/CallingClient/registration`.

Each contract has a stable id, a `published` or `internal` publication state, a canonical native
source, and an owning module (`contracts.provides`). The published SDK contracts use the
ecosystem-native `package.json` (declarations in `dist/types/index.d.ts` after a build); no OpenAPI
document applies because the package serves no HTTP API, which is why `api-specs/openapi.yaml` is
omitted. The Mobius, Mercury, Janus, User Hub, Hydra, BroadWorks, UCM, contacts, KMS, metrics, and
media dependencies are external required contracts listed in the architecture contract index.
