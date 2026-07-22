# Rules — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). These rules preserve the existing package-specific guidance while canonical module details live in source-local specs.

## Coverage Map (which docs/specs to trust)

| Module | Manifest coverage state | What it means here |
|---|---|---|
| `src/CallHistory/` | Partial | Use as a hint and cross-check code. |
| `src/CallRecording/` | Partial | Use as a hint and cross-check code. |
| `src/CallSettings/` | Partial | Use as a hint and cross-check code. |
| `src/CallingClient/` | Partial | Use as a hint and cross-check code. |
| `src/CallingClient/calling/` | Partial | Use as a hint and cross-check code. |
| `src/CallingClient/calling/CallerId/` | Partial | Use as a hint and cross-check code. |
| `src/CallingClient/line/` | Partial | Use as a hint and cross-check code. |
| `src/CallingClient/registration/` | Partial | Use as a hint and cross-check code. |
| `src/Contacts/` | Partial | Use as a hint and cross-check code. |
| `src/Metrics/` | Partial | Use as a hint and cross-check code. |
| `src/SDKConnector/` | Untracked | Code and tests are authoritative until the generated spec is validated. |
| `src/Voicemail/` | Partial | Use as a hint and cross-check code. |
| `src/mobius-socket/` | Partial | Use as a hint and cross-check code. |

## Autonomy & Ask-First

- May proceed with read-only analysis and approved, low-risk implementation inside an already confirmed module boundary.
- Ask first for public exports/events, backend contracts, security, transport, performance, or irreversible operations.
- Never push, publish, deploy, delete data, or post externally without explicit approval.

### Purpose

This document is the main orchestrator for AI assistants working in `@webex/calling`. It defines task routing(in order to use correct templates), mandatory pre-coding gates, and package-specific implementation constraints so generated code is consistent and production-safe.

**For every developer's coding request, follow the Quick Start Workflow below before implementation**

### Quick Start Workflow

When a developer provides a task, follow this workflow **in order**:

1. **Classify the task** - Use the the Task Classification decision tree below (A-F) to determine which template to use: if it's to create new module, new method, bug fix, feature enhancement in existing module, or architecture question. If you cannot confidently classify, ask the developer.
2. **STOP — Ask the developer questions** - Use the routed template's pre-questions file before implementation. Present every MANDATORY question to the developer. Wait for their answers. **Do NOT proceed until all MANDATORY fields have explicit answers from the developer.** Do not infer or assume missing requirements or fill in answers yourself.
3. **Present Spec Summary for approval** - After gathering answers, present a structured summary of what you will build (see Spec Summary Gate below). Wait for the developer to confirm.
4. **Load context** - Use the [Module Routing Table](#module-routing-table) to find and read the target module's `ai-docs/AGENTS.md` and `ARCHITECTURE.md`.
5. **Load rules** - Read [`RULES.md`](RULES.md) for coding standards.
6. **Load patterns** - Read relevant patterns from [`patterns/`](patterns/).
7. **Generate/fix code** - Follow established package patterns and the routed template's implementation steps.
8. **Validate** - Verify tests, lint, and types.
9. **Update docs** - Keep ai-docs aligned with code changes.
10. **Ask for review** - Confirm completion and offer adjustments.

### Task Classification Decision Tree

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

### Task Type Routing

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
- **Route to:** [`templates/new-module/00-master.md`](templates/new-module/00-master.md)
- **Pre-questions:** [`templates/new-module/01-pre-questions.md`](templates/new-module/01-pre-questions.md) — STOP and ask these first.
- **Follow:** Full new-module workflow including factory export, types, implementation, validation, and docs updates.

**B. Enhance Existing Module**

- Use when feature placement triage determines the requirement belongs in an existing module.
- Run method-level triage before implementation:
  - **B1. Add New Method** in existing module, or
  - **B2. Modify Existing Method** in existing module.
- Confirm if feature is backend-specific (`WXC`/`UCM`/`Broadworks`).
- **Route to:** [`templates/existing-module/feature-enhancement.md`](templates/existing-module/feature-enhancement.md)
- **Pre-questions:** Feature-enhancement template Step 0 (Placement Triage) + Pre-Enhancement Questions — STOP and ask these first.
- **Follow:** Complete placement + method-level triage first. If placement triage indicates a new module, reroute to [`templates/new-module/00-master.md`](templates/new-module/00-master.md).

**C. Add New Method**

- Use when extending an existing module with a new method/API.
- Must update interface type(s), implementation, tests, and API docs comments.
- **Route to:** [`templates/new-method/00-master.md`](templates/new-method/00-master.md)
- **Pre-questions:** [`templates/new-method/01-requirements.md`](templates/new-method/01-requirements.md) — STOP and ask these first.
- **Follow:** Method signature, implementation, tests, and validation checklist.

**D. Modify Existing Method**

- Use when changing an existing method's signature, behavior, parameters, or return type.
- Explicitly assess backward compatibility and impacted call sites.
- **Route to:** [`templates/existing-module/feature-enhancement.md`](templates/existing-module/feature-enhancement.md) (follow the same workflow, but skip placement triage — the method already exists).
- **Pre-questions:** Feature-enhancement template Pre-Enhancement Questions (skip Step 0 triage) — STOP and ask these first.
- **Follow:** Gather requirements -> Design change -> Implement -> Test -> Validate backward compatibility.

**E. Fix Bug**

- Use when behavior is incorrect or regressions are reported.
- Load the affected module's `ARCHITECTURE.md` for technical context, then investigate.
- Reproduce from tests or execution path first. Identify root cause before patching.
- **Route to:** [`templates/existing-module/bug-fix.md`](templates/existing-module/bug-fix.md)
- **Pre-questions:** Bug-fix template Section A (Questions for the Developer) — STOP and ask these first.
- **Follow:** Gather info from developer -> Investigate -> Root cause -> Fix -> Regression validation.

**F. Understand Architecture**

- Use when the task is analysis/explanation and no immediate code generation is required.
- **Route to:** Use the [Module Routing Table](#module-routing-table) to identify the relevant module, then load its `AGENTS.md` and `ARCHITECTURE.md`:
  - CallingClient: [`calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md)
  - Other modules: Load source and tests directly from the [Module Routing Table](#module-routing-table).
- **Follow:** Read-only architecture exploration with clear explanation.
- No pre-questions required (read-only task).

If a developer request includes multiple task types, split into ordered subtasks and execute each through the full classify -> question -> spec-summary -> implement sequence.

### Mandatory Pre-Questions (Before Coding)

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

### Spec Summary Gate (MANDATORY before code generation)

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

Does this match your intent? (Yes / No / Adjust)
```

**Rules:**

- Do NOT begin implementation until the developer confirms.
- If the developer says "Adjust", gather the corrections and re-present the summary.
- If the developer says "Skip" or "Just do it", you may proceed without the summary — but this must be an explicit developer choice.

### Critical Rules (Always Apply)

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

### Documentation Update Gate

After code changes, verify whether docs must be updated:

- Root-level docs:
  - Root agent entry ([`AGENTS.md`](../AGENTS.md)) — if task routing or rules changed
  - `ai-docs/RULES.md` or `ai-docs/patterns/*.md` if reusable coding patterns changed.
  - `ai-docs/templates/` (create if needed) — if a new reusable template is introduced
  - [`patterns/`](patterns/) — if a new reusable pattern is introduced
- Module-level docs (use [Module Routing Table](#module-routing-table) to locate):
  - Module's `AGENTS.md` — if usage/workflow changed
  - Module's `ARCHITECTURE.md` — if data flow/architecture changed

Only reference docs/paths that exist in this package.

## Naming

- Classes/interfaces/types follow existing PascalCase and `I`-prefixed interface conventions; methods use camelCase; constants and event keys use SCREAMING_SNAKE_CASE.
- Preserve established module/file names and exported symbol spelling.

### File Naming

| File Type        | Convention                       | Examples                                             |
| ---------------- | -------------------------------- | ---------------------------------------------------- |
| Main class       | PascalCase                       | `CallingClient.ts`, `CallHistory.ts`, `Voicemail.ts` |
| Sub-module class | camelCase                        | `call.ts`, `callManager.ts`, `register.ts`           |
| Type definitions | `types.ts`                       | `CallingClient/types.ts`, `common/types.ts`          |
| Constants        | `constants.ts`                   | `CallingClient/constants.ts`, `common/constants.ts`  |
| Test files       | `*.test.ts` (co-located)         | `CallingClient.test.ts`, `call.test.ts`              |
| Test fixtures    | `*Fixtures.ts` or `*fixtures.ts` | `callingClientFixtures.ts`, `registerFixtures.ts`    |
| Index files      | `index.ts`                       | `Logger/index.ts`, `SDKConnector/index.ts`           |

### Naming Conventions

| Element        | Convention                                   | Examples                                                                                 |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Classes        | PascalCase                                   | `CallingClient`, `CallHistory`, `Registration`, `CallManager`                            |
| Interfaces     | `I` prefix + PascalCase                      | `ICall`, `ILine`, `ICallingClient`, `IRegistration`, `ICallManager`, `ICallerId`         |
| Type aliases   | PascalCase                                   | `CallId`, `CorrelationId`, `MobiusDeviceId`, `DisplayInformation`, `WebexRequestPayload` |
| Enums          | PascalCase name, SCREAMING_SNAKE_CASE values | `CALL_EVENT_KEYS.PROGRESS`, `ERROR_TYPE.CALL_ERROR`, `METRIC_EVENT.CALL`                 |
| Constants      | SCREAMING_SNAKE_CASE                         | `DISCOVERY_URL`, `DEFAULT_KEEPALIVE_INTERVAL`, `NETWORK_FLAP_TIMEOUT`                    |
| Methods        | camelCase                                    | `getLines()`, `makeCall()`, `doHoldResume()`, `triggerRegistration()`                    |
| Private fields | `private` keyword                            | `private webex: WebexSDK`, `private metricManager: IMetricManager`                       |
| Event keys     | SCREAMING_SNAKE_CASE in enum                 | `CALL_EVENT_KEYS.ESTABLISHED`, `LINE_EVENT_KEYS.INCOMING_CALL`                           |

### @webex/calling - Coding Standards & Rules

> All rules derived from actual calling package conventions. When in doubt, follow existing code patterns.

### TypeScript Standards

- **Strict mode** is enforced via `tsconfig.json`
- **Avoid `any`** - prefer `unknown` with type narrowing. If `any` is truly necessary, add an ESLint disable comment with justification.
- **Explicit return types** on all public API methods
- **No implicit `any`** in function parameters
- All source files use `.ts` extension
- All test files use `test.ts` extension

### Eventing Base Class

All event emitters extend `Eventing<T>` from `src/Events/impl/index.ts`, which wraps `typed-emitter`:

```typescript
import {Eventing} from '../Events/impl';
import {CallEventTypes} from '../Events/types';

class Call extends Eventing<CallEventTypes> implements ICall {
  // ...
}
```

### Event Key Enums

| Enum                        | Scope            | Key Values                                                                                                                                                                   |
| --------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CALL_EVENT_KEYS`           | Call events      | `ALERTING`, `CONNECT`, `ESTABLISHED`, `HELD`, `RESUMED`, `DISCONNECT`, `REMOTE_MEDIA`, `CALLER_ID`, `CALL_ERROR`, `HOLD_ERROR`, `RESUME_ERROR`, `TRANSFER_ERROR`, `PROGRESS` |
| `LINE_EVENT_KEYS`           | Line events      | `INCOMING_CALL`                                                                                                                                                              |
| `CALLING_CLIENT_EVENT_KEYS` | Client events    | `ERROR`, `OUTGOING_CALL`, `USER_SESSION_INFO`, `ALL_CALLS_CLEARED`                                                                                                           |
| `COMMON_EVENT_KEYS`         | Shared events    | `CB_VOICEMESSAGE_CONTENT_GET`, `CALL_HISTORY_USER_SESSION_INFO`, `CALL_HISTORY_USER_VIEWED_SESSIONS`, `CALL_HISTORY_USER_SESSIONS_DELETED`                                   |
| `MOBIUS_EVENT_KEYS`         | WebSocket events | `SERVER_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_LEGACY`, `CALL_SESSION_EVENT_VIEWED`, `CALL_SESSION_EVENT_DELETED`                             |

### Event Type Maps

```typescript
// Each event key maps to a typed callback signature
type CallEventTypes = {
  [CALL_EVENT_KEYS.PROGRESS]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.CONNECT]: (callId: CallId) => void;
  // ...
};
```

### Rules

- **Always use enum constants** for event keys, never raw string literals
- **Type all event payloads** via event type maps
- **Use `on/off/emit`** from the `Eventing` base class
- **Log all emitted events** (handled automatically by `Eventing.emit()`)

### Factory Functions

Every top-level module exposes a factory function:

```typescript
// CallingClient
export const createClient = async (webex: WebexSDK, config?: CallingClientConfig): Promise<ICallingClient> => { ... };

// Public factory exports from src/api.ts
export const createCallHistoryClient = (webex: WebexSDK, logger: LoggerInterface): ICallHistory => { ... };
export const createCallSettingsClient = (webex: WebexSDK, logger: LoggerInterface, useProdWebexApis?: boolean): ICallSettings => { ... };
export const createContactsClient = (webex: WebexSDK, logger: LoggerInterface): IContacts => { ... };
export const createVoicemailClient = (webex: WebexSDK, logger: LoggerInterface): IVoicemail => { ... };

// Internal singletons (not exported from src/api.ts)
export const getMetricManager = (webex?: WebexSDK, indicator?: ServiceIndicator): IMetricManager => { ... };
export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => { ... };
```

### Per-Module File Structure

Each module should contain:

| File                          | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `ModuleName.ts` or `index.ts` | Main class implementation                       |
| `types.ts`                    | Interfaces, type aliases, enums for this module |
| `constants.ts`                | Constants for this module                       |
| `ModuleName.test.ts`          | Co-located unit tests                           |
| `*Fixtures.ts`                | Test mock data (optional)                       |

### Singleton Pattern

Used by `SDKConnector`, `CallManager`, and `MetricManager`:

```typescript
let instance: ISomeManager;

export const getSomeManager = (webex?: WebexSDK): ISomeManager => {
  if (!instance && webex) {
    instance = new SomeManager(webex);
  }
  return instance;
};
```

### JSDoc Standards

All public APIs must have JSDoc:

````typescript
/**
 * Retrieves details of the line object(s) belonging to a user.
 *
 * @example
 * ```typescript
 * const lines = callingClient.getLines();
 * ```
 *
 * @returns Dictionary of line objects keyed by lineId.
 */
getLines(): Record<string, ILine>;
````

Required tags for public methods:

- `@example` with code snippet
- `@param` for each parameter
- `@returns` describing the return value
- `@throws` if the method can throw (optional)
- `@public` for explicitly public APIs

### Need More Context?

- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
- **Event patterns**: [`patterns/event-patterns.md`](patterns/event-patterns.md)
- **Error patterns**: [`patterns/error-handling-patterns.md`](patterns/error-handling-patterns.md)

## Logging

- Use `src/Logger/` with file and method context. Never use `console.log`; never log credentials, tokens, raw PII, or sensitive media/contact payloads.

### Logger Module

Use the Logger module (`src/Logger/index.ts`), never `console.log`:

```typescript
import log from '../Logger';

// Always provide file and method names in logger context
log.info('Registration successful', {file: REGISTRATION_FILE, method: 'triggerRegistration'});
log.error('Registration failed', {file: REGISTRATION_FILE, method: 'triggerRegistration'});
log.warn('Retrying registration', {file: REGISTRATION_FILE, method: 'reconnectOnFailure'});
log.trace('Detailed debug info', {file: CALL_FILE, method: 'dial'});
log.log('General message', {file: LINE_FILE, method: 'register'});
```

### Log Format

```
webex-calling: <timestamp>: [LEVEL]: file:<file> - method:<method> - message:<message>
```

Example output:

```
webex-calling: Thu, 15 Mar 2026 10:30:00 GMT: [INFO]: file:CallingClient - method:init - message:Initialization complete
```

### Log Levels (in order)

| Level   | Numeric | Purpose                  |
| ------- | ------- | ------------------------ |
| `error` | 1       | Errors only              |
| `warn`  | 2       | Warnings + errors        |
| `log`   | 3       | General messages + above |
| `info`  | 4       | Informational + above    |
| `trace` | 5       | Full stack trace + above |

Log levels are cumulative — setting level `n` means all levels from 1 through `n` are logged. The default level is `error` (1). During SDK initialization, users can set the log level via `setLogger(level, module)`, which determines which log messages they will see at runtime.

### When to Use Each Level

| Level       | Use For                                                                                    | Example                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `log.info`  | Method entry and exit points — marks the start and completion of significant operations    | `log.info('makeCall initiated', {file: CALL_FILE, method: 'makeCall'});`                    |
| `log.log`   | API success details and important action outcomes — the substantive result of an operation | `log.log('Call connected successfully', {file: CALL_FILE, method: 'dial'});`                |
| `log.error` | Blocking failures that prevent an operation from completing                                | `log.error('Registration failed', {file: REGISTRATION_FILE, method: 'register'});`          |
| `log.warn`  | Non-blocking errors — something failed but execution can continue or a fallback was used   | `log.warn('Keepalive missed, will retry', {file: REGISTRATION_FILE, method: 'keepalive'});` |
| `log.trace` | Verbose debugging detail — full state dumps, raw payloads, internal decision paths         | `log.trace('ROAP offer details', {file: CALL_FILE, method: 'sendRoapOffer'});`              |

### File Constants for Logging

Use predefined file constants from `CallingClient/constants.ts`:

```typescript
export const CALLING_CLIENT_FILE = 'CallingClient';
export const LINE_FILE = 'line';
export const CALL_FILE = 'call';
export const CALL_MANAGER_FILE = 'callManager';
export const REGISTRATION_FILE = 'register';
export const METRIC_FILE = 'metric';
export const CALLER_ID_FILE = 'CallerId';
```

### MetricManager

Use the singleton `MetricManager` (`src/Metrics/index.ts`) via factory function:

```typescript
import {getMetricManager} from '../Metrics';

const metricManager = getMetricManager(webex, serviceIndicator);
```

### Metric Types

```typescript
enum METRIC_TYPE {
  OPERATIONAL = 'operational',
  BEHAVIORAL = 'behavioral',
}
```

### Metric Events (METRICEVENT enum)

| Event                 | Purpose                           |
| --------------------- | --------------------------------- |
| `REGISTRATION`        | Successful registration           |
| `REGISTRATION_ERROR`  | Registration failure              |
| `KEEPALIVE_ERROR`     | Keepalive failure                 |
| `CALL`                | Call control event                |
| `CALL_ERROR`          | Call control error                |
| `MEDIA`               | Media event                       |
| `MEDIA_ERROR`         | Media error                       |
| `CONNECTION_ERROR`    | Connection event                  |
| `VOICEMAIL`           | Voicemail operation               |
| `VOICEMAIL_ERROR`     | Voicemail error                   |
| `UPLOAD_LOGS_SUCCESS` | Log upload success                |
| `UPLOAD_LOGS_FAILED`  | Log upload failure                |
| `MOBIUS_DISCOVERY`    | Mobius server discovery           |
| `BNR_ENABLED`         | Background noise removal enabled  |
| `BNR_DISABLED`        | Background noise removal disabled |

### IMetricManager Methods

| Method                           | Purpose                      |
| -------------------------------- | ---------------------------- |
| `submitRegistrationMetric(...)`  | Registration success/failure |
| `submitCallMetric(...)`          | Call control events          |
| `submitMediaMetric(...)`         | Media events                 |
| `submitConnectionMetrics(...)`   | Network connection events    |
| `submitVoicemailMetric(...)`     | Voicemail operations         |
| `submitUploadLogsMetric(...)`    | Log upload events            |
| `submitBNRMetric(...)`           | Background noise removal     |
| `submitRegionInfoMetric(...)`    | Region discovery             |
| `submitMobiusServersMetric(...)` | Mobius server discovery      |

### Rules

- Submit metrics for both success and failure paths
- Include `callId` and `correlationId` for call-related metrics
- Include `trackingId` for registration metrics
- Set device info via `setDeviceInfo()` after registration

### Sensitive Data Logging

Never log sensitive data:

```typescript
// ❌ WRONG
log.info(`User token: ${token}`, {file: CALL_FILE, method: 'dial'});

// ✅ CORRECT
log.info('Token received successfully', {file: CALL_FILE, method: 'dial'});
// No sensitive data in log messages
```

## Error Handling

- Use typed errors from `src/Errors/`, log with context, and emit/reject through the owning module contract. Never swallow a failure silently.

### Error Class Hierarchy

```
ExtendedError (base)
├── CallError         - Call-level errors (with correlationId, errorLayer)
├── LineError         - Line/registration errors (with RegistrationStatus)
└── CallingClientError - Client-level errors (with RegistrationStatus)
```

### Error Types (ERRORTYPE enum)

```typescript
enum ERROR_TYPE {
  CALL_ERROR = 'call_error',
  DEFAULT = 'default_error',
  BAD_REQUEST = 'bad_request',
  FORBIDDEN_ERROR = 'forbidden',
  NOT_FOUND = 'not_found',
  REGISTRATION_ERROR = 'registration_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  TOKEN_ERROR = 'token_error',
  TOO_MANY_REQUESTS = 'too_many_requests',
  SERVER_ERROR = 'server_error',
}
```

### Error Layers (ERRORLAYER enum)

```typescript
enum ERROR_LAYER {
  CALL_CONTROL = 'call_control',
  MEDIA = 'media',
}
```

### Usage Pattern

```typescript
import {CallError, createCallError} from '../Errors/catalog/CallError';
import {ERROR_TYPE, ERROR_LAYER} from '../Errors/types';

// Create a call error
const error = createCallError(
  'Call setup failed',
  {file: CALL_FILE, method: 'dial'},
  ERROR_TYPE.CALL_ERROR,
  correlationId,
  ERROR_LAYER.CALL_CONTROL
);

// Always log errors with context
log.error('Call setup failed', {file: CALL_FILE, method: 'dial'});

// Emit error events with typed error objects
this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
```

### Rules

- Never swallow errors silently - always log with context
- Always emit error events so consumers can react
- Use the appropriate error class for the scope (CallError for calls, LineError for lines, CallingClientError for client-level)
- Include `file` and `method` in error context

## Imports / Dependencies

- Respect module boundaries and existing adapters. CallingClient reaches mobius-socket only through `src/CallingClient/utils/request.ts`. New dependencies require approval.

### Import Standards

Follow this 3-tier import order:

```typescript
// 1. External packages
import {Machine} from 'xstate';
import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';

// 2. Internal packages (within @webex)
import * as Media from '@webex/internal-media-core';

// 3. Relative imports (parent → sibling → child)
import {METRIC_EVENT, METRIC_TYPE} from '../Metrics/types';
import {CallError} from '../Errors';
import log from '../Logger';
import {CALL_FILE, METHODS} from './constants';
import {ICall} from './types';
```

### Export Standards

- Public types and interfaces: Export from module's `types.ts`
- Public factory functions: Export from `src/api.ts`
- Internal types: Keep in service-level `types.ts`, don't re-export from api
- Use named exports for types; default export for main class when only one primary export exists

### Module Routing Table

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
| `mobius-socket` | Mobius WebSocket transport (singleton client), reconnect, shutdown switchover, token refresh, message dispatch | `src/mobius-socket/`, `src/mobius-socket/ai-docs/AGENTS.md`, `src/mobius-socket/ai-docs/ARCHITECTURE.md` |

### Repository Structure

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
│   │   ├── utils/                     # Transport-agnostic API request layer
│   │   │   ├── request.ts            # APIRequest (HTTP / Mobius WSS transport selector)
│   │   │   ├── mobiusSocketMapper.ts # URI + HTTP method → MOBIUS_SOCKET_MESSAGE_TYPE mapping
│   │   │   └── wsFeatureFlag.ts      # WDM/localStorage WSS feature-flag resolution
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
│   ├── SDKConnector/                  # Webex SDK integration singleton
│   └── mobius-socket/                 # Mobius WebSocket transport (singleton client)
│       ├── mobius-socket.ts           # MobiusSocket class (connect/disconnect/sendWssRequest)
│       ├── socket/                    # Low-level WebSocket abstraction (Node `ws` + browser shim)
│       ├── config.ts                  # MobiusSocketConfig defaults
│       ├── errors.ts                  # Connection + response error classes
│       ├── types.ts                   # Public type aliases
│       └── ai-docs/                   # mobius-socket AI documentation
│           ├── AGENTS.md              # Module guide
│           └── ARCHITECTURE.md        # Module architecture
├── ai-docs/                           # AI documentation
│   ├── README.md                      # Navigation hub
│   ├── RULES.md                       # Coding standards
│   ├── patterns/                      # Pattern documentation
│   └── templates/                     # Code generation templates
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Testing

- Co-locate `*.test.ts` unit tests, use existing Jest/sinon/assert patterns, and cover success plus negative/error behavior. Run targeted Playwright journeys for cross-module flows.

### Testing Standards

For full testing patterns including test file location, mock setup, singleton mocking, Logger mocking, and test structure, see [`patterns/testing-patterns.md`](patterns/testing-patterns.md).

### Key Rules

- Tests are co-located with source files (`ModuleName.test.ts` alongside `ModuleName.ts`)
- Use test fixtures from `*Fixtures.ts` or `*fixtures.ts` files for mock data
- Mock singletons (`SDKConnector`, `CallManager`, `MetricManager`) at module level
- Never call real network endpoints in unit tests
- Cover both success and failure paths for every public method

### Functionality Validation Gate

Before marking work complete:

- API contracts compile and match intended signatures.
- Event emissions are typed and semantically correct.
- Error path behavior is deterministic (emit/return/throw as intended).
- Relevant tests pass.
- Lint and TypeScript checks pass for touched files.

## Security

- Validate inputs at SDK boundaries, keep Webex credentials inside SDK/transport adapters, preserve KMS handling for contact data, and follow `SECURITY.md`.

### No Hardcoded Credentials

Never commit:

- API keys, tokens, secrets
- Passwords or authentication data
- Private keys or certificates

## Spec-Currency & Drift Thresholds

- Update affected canonical specs and catalogs in the same merge as behavior/code changes.
- `Partial` and `Untracked` modules require code/test cross-checking; promotions require measured coverage and independent validation.

## Secrets Policy

- Never hardcode or commit secrets, tokens, keys, or connection strings. Obtain them through the host Webex SDK or approved runtime configuration and never log them.

## Concurrency & Async

- Keep promises, timers, Web Workers, WebSocket callbacks, and event handlers non-blocking. Preserve ordering, deduplication, retry, and cleanup behavior documented by the owning module.

### Async/Await

Always use async/await over raw Promises:

```typescript
// ✅ CORRECT
public async makeCall(dest: CallDetails): Promise<ICall> {
  const call = await this.callManager.createCall(dest);
  return call;
}

// ❌ AVOID (when possible)
public makeCall(dest: CallDetails): Promise<ICall> {
  return this.callManager.createCall(dest).then(call => call);
}
```

### Cleanup on Deregistration

Always clean up resources when lines or calls are torn down:

```typescript
// Remove event listeners
line.off(LINE_EVENT_KEYS.INCOMING_CALL, this.handleIncomingCall);

// Clear timers and intervals
clearInterval(this.keepaliveTimer);

// Close connections
this.deregister();
```

## Strict-Compliance Mode

- During automated lifecycle runs, stop on the first unresolved critical fact, source conflict, failed conformance check, or same-runtime validation attempt. Retry transient infrastructure failures once only.

## Maintenance

- Add or refine a rule when a review correction recurs; defer to lint/type/test tooling when it enforces the constraint.
- Patterns live under `patterns/`; deeper enforceable rules live under `rules/`.

### Code Review Checklist

Before submitting code changes, verify:

- [ ] No `any` types without ESLint disable + justification
- [ ] JSDoc on all public APIs
- [ ] Logger used with `{ file, method }` context
- [ ] Metrics tracked for success and failure paths
- [ ] Error hierarchy followed (CallError/LineError/CallingClientError)
- [ ] Events typed and emitted with enum constants
- [ ] Unit tests added/updated
- [ ] No `console.log/warn/error`
- [ ] Import order follows 3-tier convention
- [ ] Constants defined in `constants.ts`, not inline
- [ ] Types defined in `types.ts`, not inline

### Useful References

- **Navigation hub**: [`README.md`](README.md)
- **Coding standards**: [`RULES.md`](RULES.md)
- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
- **Event patterns**: [`patterns/event-patterns.md`](patterns/event-patterns.md)
- **Templates**: `ai-docs/templates/` is not present in this package yet; create it when standardized templates are added.
