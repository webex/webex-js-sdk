# Spec Index — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md). This router mirrors `.sdd/manifest.json`; system overview: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Module Registry

| Module | Responsibility | Manifest coverage state | Start here |
|---|---|---|---|
| `src` | Own the published Webex Contact Center SDK plugin surface, registration lifecycle, public method delegation, and application-facing event routing. | Partial | `ai-docs/contact-center-spec.md` |
| `src/metrics` | Own timing, taxonomy, queuing, payload preparation, and submission for Contact Center behavioral, operational, and business telemetry. | Partial | `src/metrics/ai-docs/metrics-spec.md` |
| `src/services` | Own composition and bootstrap order for backend request, realtime, data, and WebRTC service collaborators. | Partial | `src/services/ai-docs/services-spec.md` |
| `src/services/agent` | Own agent login, logout, state-change, buddy-agent, device-update, and silent-relogin request contracts. | Partial | `src/services/agent/ai-docs/agent-spec.md` |
| `src/services/config` | Own retrieval and aggregation of remote organization, agent, team, profile, auxiliary-code, dial-plan, and feature configuration. | Partial | `src/services/config/ai-docs/config-spec.md` |
| `src/services/core` | Own authenticated HTTP, realtime WebSocket lifecycle, AQM request correlation, reconnect/keepalive behavior, and shared error normalization. | Partial | `src/services/core/ai-docs/core-spec.md` |
| `src/services/task` | Own task creation, media-specific behavior, call-control operations, lifecycle orchestration, task events, and integration with the task state machine. | Partial | `src/services/task/ai-docs/task-spec.md` |
| `src/services/task/state-machine` | Own deterministic task lifecycle states, transition guards/actions, typed internal events, and state-derived UI-control availability. | Partial | `src/services/task/state-machine/ai-docs/task-state-machine-spec.md` |
| `src/utils` | Own shared pagination contracts and the bounded in-memory page cache used by Contact Center data services. | Partial | `src/utils/ai-docs/utils-spec.md` |

## Task Routing

| If the task is… | Load |
|---|---|
| Understanding the package | `ARCHITECTURE.md` |
| Working in a module | That module's specification from the registry |
| Changing exported APIs/events/types | `CONTRACTS.md`, Contact Center spec, and owning module spec |
| Changing task state | Task and Task State Machine specs |
| Changing transport/recovery | Core spec and `SECURITY.md` |
| New feature or defect | Run lifecycle intake against the affected module specs |

## Intake Routing

```text
New feature / bug / contract change → lifecycle intake questionnaire → feature spec/design
New module → update module registry + module spec + contracts
Doc/spec backfill → reconcile target → conformance → coverage → independent validation
```

## Incident History

| INC id | Date | Module | One-line | Link |
|---|---|---|---|---|
| None routed | 2026-07-07 | N/A | No incident/RCA source was supplied during onboarding. | N/A |

## Phase-Based Loading Protocol

| Phase | Load |
|---|---|
| Orient | AGENTS.md + this file |
| Specify | relevant module specs + questionnaire |
| Build | selected module specs + RULES/patterns |
| Verify | independent validation and coverage evidence |

## Spec Registry

| Doc | Location | Purpose |
|---|---|---|
| Patterns | `patterns/` | Existing implementation conventions |
| Rules | `RULES.md` | Enforceable do/don't constraints |
| Glossary | `GLOSSARY.md` | Domain language |
| Security | `SECURITY.md` | Trust boundaries and sensitive-data rules |
| Contracts | `CONTRACTS.md` | Public/export/event/dependency index |
| Service state | `SERVICE_STATE.md` | Current as-built surfaces/dependencies/flags |
| Getting started | `GETTING_STARTED.md` | Build/test loop |
| Decision records | `adr/` | Durable architecture decisions |
| Review catalog | `REVIEW_CHECKLIST.md` | Review gates |
