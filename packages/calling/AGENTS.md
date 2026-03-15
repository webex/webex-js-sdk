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

1. **Classify the task** - Determine if it's a new module, new method, bug fix, feature enhancement, or architecture question.
2. **Load context** - Use the [Module Routing Table](#module-routing-table) to find and read the target module's `ai-docs/AGENTS.md` and `ARCHITECTURE.md`.
3. **Load rules** - Read [`ai-docs/RULES.md`](ai-docs/RULES.md) for coding standards.
4. **Load patterns** - Read relevant patterns from [`ai-docs/patterns/`](ai-docs/patterns/).
5. **Ask pre-questions** - Use the relevant template's pre-questions before generating code.
6. **Generate/fix code** - Follow established package patterns.
7. **Validate** - Verify tests, lint, and types.
8. **Update docs** - Keep ai-docs aligned with code changes.

---

## Task Type Routing

**A. Create New Module**
- Use when adding a new top-level module (similar to CallHistory, Voicemail, Contacts).
- **Route to:** [`ai-docs/templates/new-module/00-master.md`](ai-docs/templates/new-module/00-master.md)

**B. Add New Method**
- Use when extending an existing module with a new method/API.
- **Route to:** [`ai-docs/templates/new-method/00-master.md`](ai-docs/templates/new-method/00-master.md)

**C. Fix Bug**
- Load the affected module's `ARCHITECTURE.md` for technical context, then investigate.

**D. Add Feature / Enhance Existing Module**
- Load the affected module's `AGENTS.md` for API surface, then implement.

**E. Understand Architecture**
- Load the affected module's `AGENTS.md` and `ARCHITECTURE.md` via the [Module Routing Table](#module-routing-table).

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
