# Calling SDK - AI Agent Guide

## Purpose

This document is the main orchestrator for AI assistants working in `@webex/calling`. It defines task routing(in order to use correct templates), mandatory pre-coding gates, and package-specific implementation constraints so generated code is consistent and production-safe.

**For every developer's coding request, follow the Quick Start Workflow below before implementation**

---

## Quick Start Workflow

When a developer provides a task, follow this workflow **in order**:

1. **Classify the task** - Use the the Task Classification decision tree below (A-F) to determine which template to use: if it's to create new module, new method, bug fix, feature enhancement in existing module, or architecture question. If you cannot confidently classify, ask the developer.
2. **STOP — Ask the developer questions** - Use the routed template's pre-questions file before implementation. Present every MANDATORY question to the developer. Wait for their answers. **Do NOT proceed until all MANDATORY fields have explicit answers from the developer.** Do not infer or assume missing requirements or fill in answers yourself.
3. **Present Spec Summary for approval** - After gathering answers, present a structured summary of what you will build (see Spec Summary Gate below). Wait for the developer to confirm.
4. **Load context** - Use the [Module Routing Table](#module-routing-table) to find and read the target module's `ai-docs/AGENTS.md` and `ARCHITECTURE.md`.
5. **Load rules** - Read [`ai-docs/RULES.md`](ai-docs/RULES.md) for coding standards.
6. **Load patterns** - Read relevant patterns from [`ai-docs/patterns/`](ai-docs/patterns/).
7. **Generate/fix code** - Follow established package patterns and the routed template's implementation steps.
8. **Validate** - Verify tests, lint, and types.
9. **Update docs** - Keep ai-docs aligned with code changes.
10. **Ask for review** - Confirm completion and offer adjustments.

---

## Task Classification Decision Tree

Use these questions **in order** to classify the developer's request. Follow the first matching path.

```
Q1: Is the request read-only (understanding, explaining, or analyzing code)?
├── YES → Type F: Understand Architecture
│
└── NO → Q2: Is something broken or behaving incorrectly?
    ├── YES → Type E: Fix Bug
    │
    └── NO → Q3: Does this involve creating a new top-level module (new directory/class)?
        ├── YES → Type A: Create New Module
        │
        └── NO → Q4: Does this involve adding a brand-new method that does not exist yet?
            │   NOTE: If the developer describes a "capability" or "feature" that
            │   happens to require a new method, check signal keywords — if the
            │   request matches Type D signals ("add capability", "enhance", "enable"),
            │   use the Disambiguation Rule to confirm with the developer.
            ├── YES → Type C: Add New Method
            │
            └── NO → Q5: Does this involve changing an existing method's signature, behavior, parameters, or return type?
                ├── YES → Type D: Modify Existing Method
                │
                └── NO → Type B: Enhance Existing Module
```

---

## Task Type Routing

**Feature Placement Triage (MANDATORY before A/B)**

- For every feature request, perform placement triage first:
  1. Can this requirement be implemented cleanly inside an existing module without breaking module boundaries?
     - **Yes** → Route to **B. Enhance Existing Module**
     - **No** → Route to **A. Create New Module**
  2. If **B** is selected, perform method-level triage:
     - Is this a **new method** addition or **existing method** modification?
- Do not start implementation until this triage is complete.

**A. Create New Module**

- Use when feature placement triage determines the requirement should not be implemented in an existing module.
- Typically applies when adding a new top-level client module (for example, a module comparable to `CallHistory`, `CallSettings`, `Contacts`, or `Voicemail`).
- Must define factory export in `src/api.ts`.
- Must include `types.ts`, `constants.ts` (if needed), implementation, and tests.
- **Route to:** [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-module/01-pre-questions.md`](ai-docs/templates/new-module/01-pre-questions.md) — STOP and ask these first.
- **Follow:** Full new-module workflow including factory export, types, implementation, validation, and docs updates.

**B. Enhance Existing Module**

- Use when feature placement triage determines the requirement belongs in an existing module.
- Run method-level triage before implementation:
  - **B1. Add New Method** in existing module, or
  - **B2. Modify Existing Method** in existing module.
- Confirm if feature is backend-specific (`WXC`/`UCM`/`Broadworks`).
- **Route to:** [`ai-docs/templates/existing-module/feature-enhancement.md`](ai-docs/templates/existing-module/feature-enhancement.md)
- **Pre-questions:** Feature-enhancement template Step 0 (Placement Triage) + Pre-Enhancement Questions — STOP and ask these first.
- **Follow:** Complete placement + method-level triage first. If placement triage indicates a new module, reroute to [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md).

**C. Add New Method**

- Use when extending an existing module with a new method/API.
- Must update interface type(s), implementation, tests, and API docs comments.
- **Route to:** [`ai-docs/templates/new-method/00-master.md`](ai-docs/templates/new-method/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-method/01-requirements.md`](ai-docs/templates/new-method/01-requirements.md) — STOP and ask these first.
- **Follow:** Method signature, implementation, tests, and validation checklist.

**D. Modify Existing Method**

- Use when changing an existing method's signature, behavior, parameters, or return type.
- Explicitly assess backward compatibility and impacted call sites.
- **Route to:** [`ai-docs/templates/existing-module/feature-enhancement.md`](ai-docs/templates/existing-module/feature-enhancement.md) (follow the same workflow, but skip placement triage — the method already exists).
- **Pre-questions:** Feature-enhancement template Pre-Enhancement Questions (skip Step 0 triage) — STOP and ask these first.
- **Follow:** Gather requirements -> Design change -> Implement -> Test -> Validate backward compatibility.

**E. Fix Bug**

- Use when behavior is incorrect or regressions are reported.
- Load the affected module's `ARCHITECTURE.md` for technical context, then investigate.
- Reproduce from tests or execution path first. Identify root cause before patching.
- **Route to:** [`ai-docs/templates/existing-module/bug-fix.md`](ai-docs/templates/existing-module/bug-fix.md)
- **Pre-questions:** Bug-fix template Section A (Questions for the Developer) — STOP and ask these first.
- **Follow:** Gather info from developer -> Investigate -> Root cause -> Fix -> Regression validation.

**F. Understand Architecture**

- Use when the task is analysis/explanation and no immediate code generation is required.
- **Route to:** Use the [Module Routing Table](#module-routing-table) to identify the relevant module, then load its `AGENTS.md` and `ARCHITECTURE.md`:
  - CallingClient: [`src/CallingClient/ai-docs/`](src/CallingClient/ai-docs/Agents.md)
  - Other modules: Load source and tests directly from the [Module Routing Table](#module-routing-table).
- **Follow:** Read-only architecture exploration with clear explanation.
- No pre-questions required (read-only task).

If a developer request includes multiple task types, split into ordered subtasks and execute each through the full classify -> question -> spec-summary -> implement sequence.

---

## Mandatory Pre-Questions (Before Coding)

For A/B/C/D/E, ask and confirm:

1. Exact target module/file(s)?
2. Backend scope: `WXC`, `UCM`, `Broadworks`, or all?
3. Public API change? (yes/no; expected signature)
4. Events affected? (event keys and payload contracts)
5. Error behavior expected? (emit event, return value, throw)
6. Metrics expectations? (success/failure tracking)
7. Test scope expected? (unit only vs additional)
8. Backward compatibility constraints?

Do not proceed until mandatory fields are explicit.

---

### Disambiguation Rule

**If you cannot confidently classify the task after using the decision tree and signal keywords, ask the developer:**

> "I want to make sure I follow the right workflow. Which of these best describes your task?"
>
> - A. Create a new module (new directory/class, e.g., a new top-level module like CallHistory)
> - B. Add a feature or enhance an existing module
> - C. Add a new method to an existing module
> - D. Modify an existing method (change signature, behavior, parameters)
> - E. Fix a bug or incorrect behavior
> - F. Understand/explain the architecture (no code changes)

**Do not guess. Do not default to the most common type. Ask.**

---

## Spec Summary Gate (MANDATORY before code generation)

After gathering answers from the developer, and **before writing any code**, present a structured summary for developer approval.

### Spec Summary Template

```
## Spec Summary — [Task Type]

**Task**: [One-sentence description of what will be done]
**Target file(s)**: [File paths that will be created or modified]
**Task type**: [A/B/C/D/E/F from classification]

### What will be built/changed:
- [Bullet 1: key change]
- [Bullet 2: key change]
- [Bullet N: key change]

### API Contract (if applicable):
- Method: `methodName(params: ParamType): Promise<ReturnType>`
- Public interface: [ICallingClient / ILine / ICall / ICallHistory / etc.]
- Backend scope: [WXC / UCM / Broadworks / all]

### Events (if applicable):
| Event | Direction | Object | Payload | Trigger |
|---|---|---|---|---|
| [event name] | [emitted / listened] | [CallingClient, Line, Call, or module] | [payload type] | [what causes it] |
(or "No events")

### Error handling:
- Failure behavior: [emit event / return error / throw]
- Error type: [CallError / LineError / CallingClientError / ExtendedError]

### Metrics (if applicable):
- Success: [metric name]
- Failure: [metric name]

### Breaking changes: [Yes/No — if yes, describe migration]

### Files to create/modify:
1. [file path] — [what changes]
2. [file path] — [what changes]

### Test plan:
- [test scope and key scenarios to cover]

---
Does this match your intent? (Yes / No / Adjust)
```

**Rules:**

- Do NOT begin implementation until the developer confirms.
- If the developer says "Adjust", gather the corrections and re-present the summary.
- If the developer says "Skip" or "Just do it", you may proceed without the summary — but this must be an explicit developer choice.

---

## Module Routing Table

| Module          | Scope Keywords                                                            | Source of Truth                                                                                          |
| --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `CallingClient` | register, line, call lifecycle, hold/resume, transfer, media, keepalive   | `src/CallingClient/`, `src/CallingClient/ai-docs/AGENTS.md`, `src/CallingClient/ai-docs/ARCHITECTURE.md` |
| `CallHistory`   | sessions, viewed/deleted records, Janus history events                    | `src/CallHistory/` + tests                                                                               |
| `CallSettings`  | forwarding, DND, voicemail settings, backend connectors                   | `src/CallSettings/` + connector tests                                                                    |
| `Contacts`      | people lookup, SCIM, groups                                               | `src/Contacts/` + `ContactsClient.test.ts`                                                               |
| `Voicemail`     | voicemail list/content/update/delete/summary/transcript                   | `src/Voicemail/` + backend connector tests                                                               |
| `Errors`        | `ExtendedError`, `CallError`, `LineError`, `CallingClientError`           | `src/Errors/`                                                                                            |
| `Events`        | event enums + typed callback maps                                         | `src/Events/types.ts`                                                                                    |
| `common`        | shared helpers (`handle*Errors`, `serviceErrorCodeHandler`, `uploadLogs`) | `src/common/Utils.ts`, `src/common/types.ts`, `src/common/constants.ts`                                  |
| `Metrics`       | metric manager + event taxonomy                                           | `src/Metrics/`                                                                                           |
| `SDKConnector`  | singleton webex bridge and listeners                                      | `src/SDKConnector/`                                                                                      |

---

## Repository Structure

```
packages/calling/
├── src/
│   ├── index.ts                       # Package entry point
│   ├── api.ts                         # Public API exports
│   ├── CallingClient/                 # Core calling module
│   │   ├── CallingClient.ts           # Main entry point class
│   │   ├── types.ts                   # ICallingClient, CallingClientConfig
│   │   ├── constants.ts               # URLs, endpoints, timers
│   │   ├── calling/                   # Call management
│   │   │   ├── call.ts                # Call class (ICall)
│   │   │   ├── callManager.ts         # CallManager singleton (ICallManager)
│   │   │   └── CallerId/             # Caller ID resolution
│   │   ├── line/                      # Line registration
│   │   │   └── index.ts              # Line class (ILine)
│   │   ├── registration/             # Mobius device registration
│   │   │   ├── register.ts           # Registration class
│   │   │   └── webWorker.ts          # Keepalive web worker
│   │   └── ai-docs/                   # CallingClient AI documentation
│   │       ├── AGENTS.md              # Module guide
│   │       └── ARCHITECTURE.md        # Module architecture
│   ├── CallHistory/                   # Call history management
│   ├── CallSettings/                  # Call forwarding, voicemail settings
│   │   ├── WxCallBackendConnector.ts  # Webex Calling backend
│   │   └── UcmBackendConnector.ts     # UCM backend
│   ├── Contacts/                      # Contacts resolution
│   ├── Voicemail/                     # Voicemail management
│   │   ├── WxCallBackendConnector.ts  # Webex Calling backend
│   │   ├── UcmBackendConnector.ts     # UCM backend
│   │   └── BroadworksBackendConnector.ts # BroadWorks backend
│   ├── common/                        # Shared types, constants, utilities
│   ├── Events/                        # Eventing base class (typed-emitter)
│   ├── Errors/                        # Error class hierarchy
│   │   └── catalog/                   # CallError, LineError, CallingClientError
│   ├── Logger/                        # Logger module
│   ├── Metrics/                       # MetricManager singleton
│   └── SDKConnector/                  # Webex SDK integration singleton
├── ai-docs/                           # AI documentation
│   ├── README.md                      # Navigation hub
│   ├── RULES.md                       # Coding standards
│   ├── patterns/                      # Pattern documentation
│   └── templates/                     # Code generation templates
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## Critical Rules (Always Apply)

1. **Logger**

   - Never use `console.*`.
   - Use package logger with `{file, method}` context.

2. **Events**

   - Use event enums/constants from `src/Events/types.ts`.
   - Never emit raw string event names.
   - Preserve typed payload contracts.

3. **Errors**

   - Prefer typed errors (`CallError`, `LineError`, `CallingClientError`) and helper handlers in `src/common/Utils.ts` for calling flows.
   - Do not swallow errors silently; log and emit/propagate intentionally.
   - Raw `Error` is currently used in some non-event precondition/failure paths; follow local module pattern unless the task explicitly requires normalization.

4. **Metrics**

   - Preserve or add success/failure metric submission in behavior changes.
   - Include contextual IDs (tracking/correlation/callId) where applicable.

5. **Type Safety**

   - Avoid `any`; prefer `unknown` + narrowing.
   - Keep public method signatures explicit.

6. **Module Pattern**
   - Keep constants in `constants.ts`, contracts in `types.ts`, behavior in module class files.
   - Add or update co-located tests (`*.test.ts`).

---

## Functionality Validation Gate

Before marking work complete:

- API contracts compile and match intended signatures.
- Event emissions are typed and semantically correct.
- Error path behavior is deterministic (emit/return/throw as intended).
- Relevant tests pass.
- Lint and TypeScript checks pass for touched files.

---

## Documentation Update Gate

After code changes, verify whether docs must be updated:

- Root-level docs:
  - This file ([`AGENTS.md`](AGENTS.md)) — if task routing or rules changed
  - `ai-docs/RULES.md` or `ai-docs/patterns/*.md` if reusable coding patterns changed.
  - `ai-docs/templates/` (create if needed) — if a new reusable template is introduced
  - [`ai-docs/patterns/`](ai-docs/patterns/) — if a new reusable pattern is introduced
- Module-level docs (use [Module Routing Table](#module-routing-table) to locate):
  - Module's `AGENTS.md` — if usage/workflow changed
  - Module's `ARCHITECTURE.md` — if data flow/architecture changed

Only reference docs/paths that exist in this package.

---

## Useful References

- **Navigation hub**: [`ai-docs/README.md`](ai-docs/README.md)
- **Coding standards**: [`ai-docs/RULES.md`](ai-docs/RULES.md)
- **TypeScript patterns**: [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md)
- **Testing patterns**: [`ai-docs/patterns/testing-patterns.md`](ai-docs/patterns/testing-patterns.md)
- **Event patterns**: [`ai-docs/patterns/event-patterns.md`](ai-docs/patterns/event-patterns.md)
- **Templates**: `ai-docs/templates/` is not present in this package yet; create it when standardized templates are added.

---
