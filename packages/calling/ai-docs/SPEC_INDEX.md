# Spec Index — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). This router mirrors `.sdd/manifest.json`; load only the docs needed for the task.

## Module Registry

| Module | Responsibility | Manifest coverage state | Start here |
|---|---|---|---|
| `src/CallHistory/` | createCallHistoryClient(webex, logger) -> ICallHistory | Partial | [`src/CallHistory/ai-docs/call-history-spec.md`](../src/CallHistory/ai-docs/call-history-spec.md) |
| `src/CallRecording/` | createCallRecordingClient(webex, logger) -> ICallRecording | Partial | [`src/CallRecording/ai-docs/call-recording-spec.md`](../src/CallRecording/ai-docs/call-recording-spec.md) |
| `src/CallSettings/` | createCallSettingsClient(webex, logger) -> ICallSettings | Partial | [`src/CallSettings/ai-docs/call-settings-spec.md`](../src/CallSettings/ai-docs/call-settings-spec.md) |
| `src/CallingClient/` | createClient(config) -> ICallingClient | Partial | [`src/CallingClient/ai-docs/calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md) |
| `src/CallingClient/calling/` | ICall and CallManager call lifecycle operations | Partial | [`src/CallingClient/calling/ai-docs/calling-spec.md`](../src/CallingClient/calling/ai-docs/calling-spec.md) |
| `src/CallingClient/calling/CallerId/` | Caller identity resolution and incremental display-information callbacks | Partial | [`src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md`](../src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md) |
| `src/CallingClient/line/` | ILine call and registration operations | Partial | [`src/CallingClient/line/ai-docs/line-spec.md`](../src/CallingClient/line/ai-docs/line-spec.md) |
| `src/CallingClient/registration/` | Internal registration, deregistration, failover, failback, and keepalive lifecycle | Partial | [`src/CallingClient/registration/ai-docs/registration-spec.md`](../src/CallingClient/registration/ai-docs/registration-spec.md) |
| `src/Contacts/` | createContactsClient(webex, logger) -> IContacts | Partial | [`src/Contacts/ai-docs/contacts-spec.md`](../src/Contacts/ai-docs/contacts-spec.md) |
| `src/Metrics/` | MetricManager singleton and typed calling metric submission methods | Partial | [`src/Metrics/ai-docs/metrics-spec.md`](../src/Metrics/ai-docs/metrics-spec.md) |
| `src/SDKConnector/` | Singleton adapter for Webex SDK request, service, credential, device, and Mercury access | Untracked | [`src/SDKConnector/ai-docs/sdk-connector-spec.md`](../src/SDKConnector/ai-docs/sdk-connector-spec.md) |
| `src/Voicemail/` | createVoicemailClient(webex, logger) -> IVoicemail | Partial | [`src/Voicemail/ai-docs/voicemail-spec.md`](../src/Voicemail/ai-docs/voicemail-spec.md) |
| `src/mobius-socket/` | MobiusSocket singleton request/response API | Partial | [`src/mobius-socket/ai-docs/mobius-socket-spec.md`](../src/mobius-socket/ai-docs/mobius-socket-spec.md) |

## Task Routing

| If the task is… | Load |
|---|---|
| Understanding the package | `ARCHITECTURE.md` |
| Changing a public API/event | `CONTRACTS.md`, owning module spec, `RULES.md` |
| Changing security/identity/data handling | `SECURITY.md`, owning module spec |
| Adding or changing an implementation pattern | matching file under `patterns/` |
| Working in `src/CallHistory/` | [`src/CallHistory/ai-docs/call-history-spec.md`](../src/CallHistory/ai-docs/call-history-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallRecording/` | [`src/CallRecording/ai-docs/call-recording-spec.md`](../src/CallRecording/ai-docs/call-recording-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallSettings/` | [`src/CallSettings/ai-docs/call-settings-spec.md`](../src/CallSettings/ai-docs/call-settings-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallingClient/` | [`src/CallingClient/ai-docs/calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallingClient/calling/` | [`src/CallingClient/calling/ai-docs/calling-spec.md`](../src/CallingClient/calling/ai-docs/calling-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallingClient/calling/CallerId/` | [`src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md`](../src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallingClient/line/` | [`src/CallingClient/line/ai-docs/line-spec.md`](../src/CallingClient/line/ai-docs/line-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/CallingClient/registration/` | [`src/CallingClient/registration/ai-docs/registration-spec.md`](../src/CallingClient/registration/ai-docs/registration-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/Contacts/` | [`src/Contacts/ai-docs/contacts-spec.md`](../src/Contacts/ai-docs/contacts-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/Metrics/` | [`src/Metrics/ai-docs/metrics-spec.md`](../src/Metrics/ai-docs/metrics-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/SDKConnector/` | [`src/SDKConnector/ai-docs/sdk-connector-spec.md`](../src/SDKConnector/ai-docs/sdk-connector-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/Voicemail/` | [`src/Voicemail/ai-docs/voicemail-spec.md`](../src/Voicemail/ai-docs/voicemail-spec.md) plus the relevant `RULES.md`/pattern sections |
| Working in `src/mobius-socket/` | [`src/mobius-socket/ai-docs/mobius-socket-spec.md`](../src/mobius-socket/ai-docs/mobius-socket-spec.md) plus the relevant `RULES.md`/pattern sections |

## Intake Routing

```text
New feature or defect          -> lifecycle intake questionnaire
New module/component           -> confirm module boundary, then spec + intake
Documentation/spec backfill    -> reconcile target, generate, run conformance
Public/security/perf change    -> explicit plan and human approval before implementation
```

## Incident History

No repository-local incident/RCA index was found under `packages/calling/`. Add references here when an authoritative incident source is supplied.

## Phase-Based Loading Protocol

| Phase | Load |
|---|---|
| Orient | `AGENTS.md` + this file |
| Specify | relevant module spec + questionnaire/intake record |
| Build | selected module spec + relevant patterns/rules |
| Verify | conformance, coverage, and independent validation evidence |

## Spec Registry

| Doc | Location | Purpose |
|---|---|---|
| Architecture | `ARCHITECTURE.md` | Package/component ownership and interaction |
| Patterns | `patterns/` | Code-grounded implementation conventions |
| Rules | `RULES.md` + `rules/` | Enforceable package constraints |
| Glossary | `GLOSSARY.md` | Calling-domain language and code anchors |
| Security | `SECURITY.md` | Trust boundaries and sensitive-data rules |
| Contracts | `CONTRACTS.md` | Export/event/dependency catalog |
| Service state | `SERVICE_STATE.md` | Current events, dependencies, flags, and metrics |
| Getting started | `GETTING_STARTED.md` | Install/build/test loop |
| Decision records | `adr/` | Durable architecture rationale |
| Review catalog | `REVIEW_CHECKLIST.md` | Core, coverage, and cross-runtime review checks |
