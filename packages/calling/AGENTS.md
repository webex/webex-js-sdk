# Calling SDK - AI Agent Guide

## Purpose

This is the main orchestrator for AI assistants working with the `@webex/calling` package. It routes you to the correct templates and documentation based on the task and provides critical rules for code generation.

**For every developer request, follow the Quick Start Workflow below.**

---

## Package Overview

`@webex/calling` is the Webex Calling SDK for browser-based telephony. It provides:

- **Line registration** with Mobius signaling backend
- **Call management** (dial, answer, hold, transfer, DTMF, mute)
- **Call history** retrieval and management
- **Call settings** (call forwarding, voicemail settings)
- **Contacts** resolution via SCIM/People API
- **Voicemail** management (list, read, delete, transcribe)

---

## Technology Stack

| Technology | Purpose | Version |
|---|---|---|
| TypeScript | Language (strict mode) | 4.x |
| xstate | Call & ROAP state machines | 4.30.6 |
| Jest | Unit testing | 29.x |
| async-mutex | Serialized async operations | 0.4.0 |
| @webex/internal-media-core | WebRTC media engine | 2.22.1 |
| typed-emitter | Typed event emitters | - |
| uuid | Unique ID generation | 8.3.2 |

---

## Quick Start Workflow

When a developer provides a task, follow this workflow **in order**:

1. **Classify the task** - Use the [Task Classification Decision Tree](#task-classification-decision-tree) below to identify the task type (A-F). If you cannot confidently classify, ask the developer.
2. **STOP — Ask the developer questions** - Open the routed template's pre-questions file. Present every MANDATORY question to the developer. Wait for their answers. **Do NOT proceed until all MANDATORY fields have explicit answers from the developer.** Do not infer, assume, or fill in answers yourself.
3. **Present Spec Summary for approval** - After gathering answers, present a structured summary of what you will build (per the template's spec summary format). Wait for the developer to confirm.
4. **Load context** - Use the [Module Routing Table](#module-routing-table) to find and read the target module's `ai-docs/AGENTS.md` and `ARCHITECTURE.md`, then load relevant patterns.
5. **Break down large or multi-part tasks** - If the prompt mixes multiple tasks (for example, "add a method" and "fix a bug"), split into smaller scoped subtasks and execute them one by one — each subtask goes through steps 1-3 independently.
6. **Generate/fix code** - Follow established package patterns and the routed template's implementation steps.
7. **Validate** - Verify behavior, tests, lint, and type checks.
8. **Update docs** - Keep ai-docs aligned with code changes.
9. **Ask for review** - Confirm completion and offer adjustments.

---

## Task Classification Decision Tree

Use these questions **in order** to classify the developer's request. Follow the first matching path.

```
Q1: Is the task read-only (understanding, explaining, or analyzing code)?
├── YES → Type E: Understand Architecture
│
└── NO → Q2: Is something broken or behaving incorrectly?
    ├── YES → Type C: Fix Bug
    │
    └── NO → Q3: Does this involve creating a new file, class, or module?
        ├── YES → Type A: Create New Module
        │
        └── NO → Q4: Does this involve adding a brand-new method that does not exist yet?
            ├── YES → Type B: Add New Method
            │
            └── NO → Q5: Does this involve changing an existing method's signature, behavior, parameters, or return type?
                ├── YES → Type F: Modify Existing Method
                │
                └── NO → Type D: Add Feature / Enhance Existing Module
```

### Signal Keywords by Task Type

| Task Type | Signal Keywords in Developer Request |
|---|---|
| **A. Create New Module** | "new module", "new class", "create a module for", "add a new service", "like CallHistory/Voicemail" |
| **B. Add New Method** | "add a method", "add an API", "new method", "expose a new function", "add [methodName] to" |
| **C. Fix Bug** | "bug", "broken", "not working", "regression", "incorrect", "error", "crash", "unexpected behavior", "fix" |
| **D. Add Feature** | "enhance", "add feature", "add capability", "improve", "extend", "support for", "enable" |
| **E. Understand Architecture** | "explain", "how does", "understand", "architecture", "what is", "walk me through", "show me" |
| **F. Modify Existing Method** | "change", "modify", "update", "add parameter to", "change return type", "rename", "refactor [methodName]" |

### Disambiguation Rule

**If you cannot confidently classify the task after using the decision tree and signal keywords, ask the developer:**

> "I want to make sure I follow the right workflow. Which of these best describes your task?"
> - A. Create a new module (new file/class)
> - B. Add a new method to an existing module
> - C. Fix a bug or incorrect behavior
> - D. Add a feature or enhance an existing module
> - E. Understand/explain the architecture (no code changes)
> - F. Modify an existing method (change signature, behavior, parameters)

**Do not guess. Do not default to the most common type. Ask.**

---

## Task Type Routing

**A. Create New Module**
- Use when adding a new top-level module (similar to CallHistory, Voicemail, Contacts).
- **Route to:** [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-module/01-pre-questions.md`](ai-docs/templates/new-module/01-pre-questions.md) — STOP and ask these first.
- **Follow:** Full new-module workflow including validation and docs updates.

**B. Add New Method**
- Use when extending an existing module with a new method/API.
- **Route to:** [`ai-docs/templates/new-method/00-master.md`](ai-docs/templates/new-method/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-method/01-requirements.md`](ai-docs/templates/new-method/01-requirements.md) — STOP and ask these first.
- **Follow:** Method signature, implementation, tests, and validation checklist.

**C. Fix Bug**
- Use when behavior is incorrect or regressions are reported.
- **Route to:** [`ai-docs/templates/existing-module/bug-fix.md`](ai-docs/templates/existing-module/bug-fix.md)
- **Pre-questions:** Bug-fix template Section A (Questions for the Developer) — STOP and ask these first.
- **Follow:** Gather info from developer → Investigate → Root cause → Fix → Regression validation.

**D. Add Feature / Enhance Existing Module**
- Use when enhancing capabilities of an existing module, then decide placement via triage:
  - Existing module enhancement, or
  - New standalone module creation.
- **Route to:** [`ai-docs/templates/existing-module/feature-enhancement.md`](ai-docs/templates/existing-module/feature-enhancement.md)
- **Pre-questions:** Feature-enhancement template Step 0 (Placement Triage) + Pre-Enhancement Questions — STOP and ask these first.
- **Follow:** Run mandatory feature placement triage. If triage indicates a new module, reroute to [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md).

**E. Understand Architecture**
- Use when the task is analysis/explanation and no immediate code generation is required.
- **Route to:** Use the [Module Routing Table](#module-routing-table) to identify the relevant module, then load its `AGENTS.md` and `ARCHITECTURE.md`.
- **Follow:** Read-only architecture exploration with clear explanation.
- No pre-questions required (read-only task).

**F. Modify Existing Method**
- Use when changing an existing method's signature, behavior, parameters, or return type.
- **Route to:** [`ai-docs/templates/existing-module/feature-enhancement.md`](ai-docs/templates/existing-module/feature-enhancement.md) (follow the same workflow, but skip placement triage — the method already exists).
- **Pre-questions:** Feature-enhancement template Section A: Pre-Enhancement Questions (skip Step 0 triage) — STOP and ask these first.
- **Follow:** Gather requirements → Design change → Implement → Test → Validate backward compatibility.

If a developer request includes multiple task types, split into ordered subtasks and execute each through the full classify → question → spec-summary → implement sequence.

---

## Module Routing Table

Use this table to identify which module's ai-docs to load based on the developer's task:

| Module | Scope / Keywords | Location | ai-docs |
|---|---|---|---|
| **CallingClient** | line, register, call, dial, answer, hold, transfer, mute, media | `src/CallingClient/` | [`src/CallingClient/ai-docs/`](src/CallingClient/ai-docs/AGENTS.md) |
| **CallHistory** | call history, sessions, recent calls, missed calls | `src/CallHistory/` | - |
| **CallSettings** | call forwarding, voicemail settings, DND | `src/CallSettings/` | - |
| **Contacts** | contacts, SCIM, people, directory | `src/Contacts/` | - |
| **Voicemail** | voicemail, messages, transcription | `src/Voicemail/` | - |
| **common** | utilities, shared types, constants | `src/common/` | - |
| **Events** | event types, event emitter, Eventing class | `src/Events/` | - |
| **Errors** | error classes, ExtendedError, CallError, LineError | `src/Errors/` | - |
| **Logger** | logging, log levels, log format | `src/Logger/` | - |
| **Metrics** | metrics, telemetry, MetricManager | `src/Metrics/` | - |
| **SDKConnector** | webex SDK, mercury, websocket, listeners | `src/SDKConnector/` | - |

---

## Public API Surface

All public exports from `src/api.ts`:

### Factory Functions

| Function | Returns | Description |
|---|---|---|
| `createClient(webex, config?)` | `Promise<ICallingClient>` | Create and initialize a CallingClient |
| `createCallHistoryClient(webex, config?)` | `ICallHistory` | Create a CallHistory client |
| `createCallSettingsClient(webex, config?)` | `ICallSettings` | Create a CallSettings client |
| `createContactsClient(webex, config?)` | `IContacts` | Create a Contacts client |
| `createVoicemailClient(webex, config?)` | `IVoicemail` | Create a Voicemail client |

### Exported Interfaces

`ICallingClient`, `ILine`, `ICall`, `ICallHistory`, `ICallSettings`, `IContacts`, `IVoicemail`

### Exported Classes

`CallingClient`, `CallHistory`, `CallSettings`, `ContactsClient`, `Voicemail`

### Exported Types

`Contact`, `ContactGroup`, `CallForwardSetting`, `CallForwardAlwaysSetting`, `VoicemailSetting`, `VoicemailResponseEvent`

---

## Package Commands

```bash
# Build
yarn build          # TypeScript compilation via tsc
yarn build:src      # Build source only

# Test
yarn test:unit      # Run Jest unit tests (--runInBand)
yarn test:style     # ESLint style check

# Lint & Format
yarn fix:lint       # Auto-fix ESLint issues
yarn fix:prettier   # Auto-fix formatting

# Documentation
yarn build:docs     # Generate TypeDoc documentation
```

---

## Repository Structure

```
packages/calling/
├── src/
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
│   │   └── ai-docs/                  # CallingClient AI documentation
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

### 1. Logger Usage (MANDATORY)

**NEVER use `console.log()`.** Always use the Logger module with file/method context:
```typescript
import log from '../Logger';
log.info('message', { file: 'MyFile', method: 'myMethod' });
```

### 2. Metrics Tracking (MANDATORY)

All operations must submit metrics via `IMetricManager`. Use `METRIC_EVENT` enum values.

### 3. Error Handling (MANDATORY)

Use the error class hierarchy: `ExtendedError` -> `CallError` / `LineError` / `CallingClientError`. Never swallow errors silently.

### 4. Event Constants (MANDATORY)

Use typed event key enums (`CALL_EVENT_KEYS`, `LINE_EVENT_KEYS`, `CALLING_CLIENT_EVENT_KEYS`), never raw string literals.

### 5. No `any` Type (MANDATORY)

Avoid `any`. Prefer `unknown` with type narrowing.

---

## Validation Checklist (After Code Generation)

- [ ] **Logger**: All methods use Logger with `{ file, method }` context
- [ ] **Metrics**: Operations track success/failure via MetricManager
- [ ] **Error Handling**: Uses error class hierarchy (CallError, LineError, CallingClientError)
- [ ] **Types**: All public types have JSDoc with `@public` tag
- [ ] **Events**: Uses event key enums, not string literals
- [ ] **Tests**: Added/updated unit tests co-located with source
- [ ] **Exports**: New public types/interfaces exported from `src/api.ts`
- [ ] **No console.log**: Zero instances of console.log/warn/error

---

## Need More Context?

- **Navigation hub**: [`ai-docs/README.md`](ai-docs/README.md)
- **Coding standards**: [`ai-docs/RULES.md`](ai-docs/RULES.md)
- **TypeScript patterns**: [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md)
- **Testing patterns**: [`ai-docs/patterns/testing-patterns.md`](ai-docs/patterns/testing-patterns.md)
- **Event patterns**: [`ai-docs/patterns/event-driven-patterns.md`](ai-docs/patterns/event-driven-patterns.md)
- **New method template**: [`ai-docs/templates/new-method/00-master.md`](ai-docs/templates/new-method/00-master.md)
- **New module template**: [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md)
- **Bug fix template**: [`ai-docs/templates/existing-module/bug-fix.md`](ai-docs/templates/existing-module/bug-fix.md)
- **Feature enhancement template**: [`ai-docs/templates/existing-module/feature-enhancement.md`](ai-docs/templates/existing-module/feature-enhancement.md)
