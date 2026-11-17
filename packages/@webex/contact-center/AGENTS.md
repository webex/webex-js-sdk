<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:03:58Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/contact-center`. `@webex/contact-center` is a published Webex SDK
plugin for agent registration, configuration, realtime events, task/call control, data lookup, and
telemetry. It registers as `webex.cc` (`src/index.ts`). This file orients agents working in this
package. The monorepo root `AGENTS.md` governs workspace-wide setup.

**What it is:**

- A TypeScript SDK package embedded in the Webex SDK host.
- A client of Webex Contact Center REST, WebSocket, calling, and metrics services.

**What it is NOT:**

- It is not a standalone backend and owns no durable datastore.
- It does not render a UI; it exposes state and UI-control contracts to host applications.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Code and tests are the behavioral referee; never invent APIs, paths, events, flags, or states.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

Developer workflow:

1. Read this file for package rules, then use [`docs/specs/README.md`](docs/specs/README.md) to
   select the owning canonical module spec.
2. Check the module spec's requirements, public surface, source paths, test evidence, and documented
   gaps against the relevant code/tests.
3. Before coding, present the affected files and contracts and wait for confirmation. For a new
   method, settle its target file and name, parameters (required or optional), return shape, backend
   call (HTTP verb, endpoint, payload, and whether the result arrives in the HTTP response or as a
   WebSocket message), events, metric names, and success and failure behavior. For a bug, settle the
   unexpected and expected behavior, the reproduction steps or logs and tracking id, and the affected
   layer (plugin `src/cc.ts`, a service under `src/services/`, core `src/services/core/`, or types).
4. Implement the smallest approved change; update the owning module spec, the contract index in
   [`docs/architecture.md`](docs/architecture.md), and `.sdd/manifest.json` when public behavior or
   routing changes.
5. Run the package commands below plus manifest/conformance checks; materially changed generated
   specs require validation on the configured independent runtime.
6. Review the final diff for source/test fidelity, compatibility, secrets, and unrelated files before
   staging.

Task routing inside this file: a new method or feature on an existing service uses
[Public methods and new code placement](#public-methods-and-new-code-placement) and
[Logging, metrics, and errors](#logging-metrics-and-errors); a new service also uses
[Services and constants](#services-and-constants); a bug fix starts from
[Common bug patterns](#common-bug-patterns); every change ends with [Testing Workflow](#4-testing-workflow).

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, interactions, and the
  contract index;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the affected module's spec: [`src/docs/README.md`](src/docs/README.md) (plugin and public API),
  [`src/metrics/docs/README.md`](src/metrics/docs/README.md),
  [`src/services/docs/README.md`](src/services/docs/README.md),
  [`src/services/agent/docs/README.md`](src/services/agent/docs/README.md),
  [`src/services/config/docs/README.md`](src/services/config/docs/README.md),
  [`src/services/core/docs/README.md`](src/services/core/docs/README.md),
  [`src/services/task/docs/README.md`](src/services/task/docs/README.md),
  [`src/services/task/state-machine/docs/README.md`](src/services/task/state-machine/docs/README.md),
  or [`src/utils/docs/README.md`](src/utils/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source;
`.sdd/manifest.json` is authoritative for SDD coverage, and `docs/specs/README.md` mirrors it. Every
module is `Partial` today: existing docs help, but code must be cross-checked until migration,
coverage, and validation pass. This package publishes an SDK, so its contract artifact is
`package.json` with the `src/index.ts` typed entry (`types` is `dist/types/index.d.ts`) and the
`dist/webex.js` main built from `src/webex.js`. It serves no HTTP API of its own, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` at the
workspace root and the package scripts below from this package directory,
`packages/@webex/contact-center`, where `package.json` defines them. From the workspace root,
`yarn workspace @webex/contact-center` followed by the script name runs the same script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn test:unit` (the `@webex/contact-center` workspace `test:unit` script; Jest collects coverage) |
| Run linters            | `yarn test:style` (the workspace `test:style` script: eslint over `src/**/*.ts`) |
| Build/release artifact | `yarn build:src` (babel output, source maps, then `yarn build` for `@webex/calling` and the `dist/types` declarations) |
| Format code            | `yarn fix:prettier` (prettier over `src/**/*.ts`); `yarn fix:lint` applies eslint fixes |
| Build with dependencies | `yarn compile` (runs `build:src` for this package and its workspace dependencies in topological order) |
| Style and unit together | `yarn test` (runs `test:style`, then `test:unit`) |
| E2E | `yarn test:e2e` (Playwright with the workspace `playwright.config.ts`, which runs the monorepo-root `cc_playwright/` suites; see its README) |
| API reference | `yarn build:docs` (typedoc into the workspace `docs/wxcc` folder, outside this package) |
| Publish | `yarn deploy:npm` (release automation only) |

To run one spec file, add the `--targets` option that the workspace root `AGENTS.md` describes, with a
path relative to `test/unit/spec/` (for example `cc.ts`). There is no `test:integration` or
`test:browser` script.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/contact-center`.

Primary outcomes:

- Deliver production-safe changes with lint and unit tests (with coverage) passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented, after the affected files and contracts were confirmed.
2. Unit tests and lint pass; the 85% coverage bar remains satisfied.
3. Public types/events/methods remain compatible or include a migration plan.
4. State, error, timeout, and cleanup paths are covered.
5. Spec/docs and `.sdd/manifest.json` are updated with code changes.
6. No secrets or sensitive data are committed or logged.
7. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | TypeScript sources (one JavaScript entry, `src/webex.js`, and a JavaScript keepalive worker) on node | node 22.14 for workspace development (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` `>=20.x`; typescript `5.4.5` |
| Build tool       | yarn workspaces, `@webex/legacy-tools` over babel, and `tsc` for declarations | yarn `3.4.1` (root `packageManager`) |
| Test framework   | jest through `webex-legacy-tools test --unit --runner jest`, `@webex/jest-config-legacy` extended by `jest.config.js`, `@webex/test-helper-mock-webex` | jest `27.5.1` |
| Lint/format      | eslint with the monorepo root `.eslintrc.js` (the package has none of its own), prettier | eslint `^8.24.0`, prettier `2.5.1` |
| Runtime libraries | `WebexPlugin` from `@webex/webex-core`, Node `events` `EventEmitter`, XState, WebSocket, `@webex/calling` for WebRTC, Mercury, metrics | xstate `5.24.0` |

### Project Map

Request path: Host Webex SDK → ContactCenter plugin → Services/Task/Metrics → REST + WebSocket + WebRTC
backends. The full architecture is in [`docs/architecture.md`](docs/architecture.md).

- `src/`: public plugin/API orchestration
- `src/metrics/`: telemetry
- `src/services/`: service composition and integrations
- `src/services/{agent,config,core}/`: agent, profile, and transport capabilities
- `src/services/task/`: task/call lifecycle
- `src/services/task/state-machine/`: typed XState lifecycle engine
- `src/utils/`: pagination/page cache contracts

Key files:

- `src/index.ts`: registers the `cc` plugin and lists every published export and type.
- `src/cc.ts`: `ContactCenter` (extends `WebexPlugin`), the `webex.cc` public API and WebSocket event
  fan-out.
- `src/types.ts`, `src/constants.ts`, `src/config.ts`: public types, SDK-wide constants and
  `METHODS`, and the plugin config defaults (`allowMultiLogin`, `allowAutomatedRelogin`, and others).
- `src/logger-proxy.ts`: `LoggerProxy`, the only logging entry point.
- `src/services/index.ts`: the `Services` singleton.
- `src/services/AddressBook.ts`, `EntryPoint.ts`, `Queue.ts`, `UserPreference.ts`, `ApiAiAssistant.ts`,
  `WebCallingService.ts` and the other single-file services beside them.
- `src/webex.js`, `src/webex-config.ts`: the standalone `Webex` constructor and its config; `umd/` holds
  the committed browser bundle.
- `test/unit/spec/`: unit specs mirroring `src/`; `test/unit/fixtures/` and `__mocks__/workerMock.js`
  hold shared helpers.
- `dist/`: generated build output. Never edit by hand.

### Critical Constraints

- AQM completion may arrive over WebSocket after an HTTP acknowledgement; do not treat the
  acknowledgement as completion. Preserve AQM HTTP-plus-WebSocket correlation, timeout, and recovery
  semantics; settlement and the `TIMEOUT_REQ` default are CORE-R-003 in
  [core Requirements](src/services/core/docs/README.md#requirements).
- Listener cleanup requires the same function reference used at registration; preserve listener
  identity for cleanup and avoid blocking the event loop in handlers.
- Config aggregation is all-or-nothing; returning a partial profile creates inconsistent runtime
  behavior. `getAgentConfig` awaits the user desktop-login aggregate, then fetches the five dependent
  parts with one `Promise.all`, and rethrows on any failure (`src/services/config/index.ts`).
- Task transitions must go through typed TaskEvent mapping and guards; see
  [`src/services/task/state-machine/docs/README.md`](src/services/task/state-machine/docs/README.md).
- PageCache bypasses search/filter/attributes/sort queries to avoid stale or incorrect reuse
  (`canUseCache` in `src/utils/PageCache.ts`).
- Use MetricsManager timing/tracking patterns without blocking product behavior.
- Use typed event constants; preserve `trigger` versus `emit` ownership (see
  [Events](#events)).
- Credentials come from the host Webex SDK; validate inputs and use authenticated service routing.
- `cc.register()` must run before any agent operation: it opens the WebSocket, so task and agent
  events arrive only after it.
- The published surface is what `src/index.ts` exports; renaming or removing an export, a public
  method, an event name, or a type field is a breaking change for host applications.

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`
4. `yarn test:e2e` only when the change needs it (see Ask First).

On a fresh or outdated checkout, run `yarn compile` first so workspace dependencies such as
`@webex/calling` have a current `dist/`; specs also import workspace packages such as
`@webex/test-helper-mock-webex` and `@webex/internal-plugin-mercury` by name.

Testing rules:

- Mirror source paths under `test/unit/spec/`; cover positive and negative behavior and retain the 85%
  global coverage threshold.
- Every new source file must have a corresponding test file. The test file location mirrors the
  source file path: `src/cc.ts` → `test/unit/spec/cc.ts`, `src/logger-proxy.ts` →
  `test/unit/spec/logger-proxy.ts`, `src/metrics/MetricsManager.ts` →
  `test/unit/spec/metrics/MetricsManager.ts`, `src/services/agent/index.ts` →
  `test/unit/spec/services/agent/index.ts`, `src/services/task/Task.ts` →
  `test/unit/spec/services/task/Task.ts`, `src/services/WebCallingService.ts` →
  `test/unit/spec/services/WebCallingService.ts`. Logic files with no mirrored spec today include
  `src/services/index.ts`, `src/services/core/Err.ts`, `src/services/task/state-machine/actions.ts`,
  `src/services/task/taskDataNormalizer.ts`, `src/services/wxAppTelephonyUtils.ts`, and
  `src/utils/PageCache.ts`; pin their current behavior before changing them.
- `jest.config.js` sets `collectCoverage: true`, `clearMocks: true`, and 85% global branch, function,
  line, and statement thresholds. Reports go to `coverage/` (junit under `coverage/junit`, the HTML
  report, lcov) and, through `testResultsProcessor: 'jest-junit'`, to `junit.xml` at the package root
  (ignored by Git).
- Specs use Jest (`expect`, `jest.fn()`, `jest.mock`, `jest.spyOn`), not the sinon and chai helpers
  the workspace root `AGENTS.md` describes for other plugins. Use fake timers
  (`jest.useFakeTimers()`) for time-dependent behavior, and parametrize (`it.each`) when more than
  three cases are alike.
- For a new method, test the success case, the error case (including the `getErrorDetails` call), edge
  cases, the metrics tracking (`timeEvent` and `trackEvent` calls asserted), the logging (`LoggerProxy`
  calls), and optional parameters.
- For a bug fix, add a regression test that reproduces the original bug (fails before the fix, passes
  after) to prevent the same issue from recurring.
- Prefer exact matches over `expect.objectContaining` in new tests. Exact matches catch unexpected
  field changes and keep tests rigorous: use `toEqual` with the full expected object, and use
  `expect.objectContaining()` or `expect.arrayContaining()` only for a specific reason such as
  dynamic fields like timestamps. Existing tests may use `expect.objectContaining` for complex
  objects; this is acceptable but not preferred for new code.
- Do not remove tests to make CI pass.

Spec setup used by `test/unit/spec/cc.ts`:

- `import 'jsdom-global/register';` first, then `import '../../../__mocks__/workerMock';`, which
  defines a global `Worker` (its `postMessage` calls `onmessage`) for the keepalive worker and sets
  `global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');`.
- `jest.mock` the module singletons (`src/logger-proxy`, `src/services`, `src/services/task/TaskManager`,
  `src/metrics/MetricsManager`, `src/services/core/WebexRequest`), and mock `uuid` with
  `jest.mock('uuid', () => ({v4: () => 'mock-tracking-uuid'}))`.
- Build the host with `MockWebex` and cast it once: `MockWebex` requires the `as unknown as WebexSDK`
  double-cast, so do not use this pattern elsewhere.
- Spy the singleton getters and the error helper, then construct the plugin:

```typescript
webex = MockWebex({
  children: {
    cc: ContactCenter,
    mercury: Mercury,
  },
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  credentials: {
    getOrgId: jest.fn(() => 'mockOrgId'),
  },
  config: config,
  once: jest.fn((event, callback) => callback()),
}) as unknown as WebexSDK;

jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);
jest.spyOn(Services, 'getInstance').mockReturnValue(mockServicesInstance as any);
jest.spyOn(TaskManager, 'getTaskManager').mockReturnValue(mockTaskManager);
jest.spyOn(WebexRequest, 'getInstance').mockReturnValue(mockWebexRequest);
webex.cc = new ContactCenter({parent: webex});
getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails');
```

Service specs that construct a class directly (for example `test/unit/spec/services/AddressBook.ts`)
automock `jest.mock('../../../../src/logger-proxy')` and `src/metrics/MetricsManager`, pass a plain
mock `webex` with `credentials.getOrgId` and `request`, and reset `(WebexRequest as any).instance =
undefined` in `beforeEach`. Internal plugins come from real children (`mercury: Mercury`) plus
`jest.spyOn(webex.internal.mercury, 'connect')`.

Event listeners and their callbacks are tested by spying on the registration, extracting the callback
via `mock.calls`, and invoking it directly:

```typescript
it('should handle websocket message and emit event', async () => {
  await webex.cc.register(); // register() adds the 'message' listener

  // Step 1: Find the registered callback via mock.calls
  const onCalls = mockServicesInstance.webSocketManager.on.mock.calls;
  const messageCall = onCalls.find(([event]) => event === 'message');
  const wsHandler = messageCall[1];

  // Step 2: Spy on the emit
  const emitSpy = jest.spyOn(webex.cc, 'emit');

  // Step 3: Invoke the callback directly with test data
  wsHandler(JSON.stringify({
    type: 'AgentStateChange',
    data: { type: 'AgentStateChangeSuccess', agentId: 'agent-123', state: 'Available' },
  }));

  // Step 4: Assert exact emit arguments
  expect(emitSpy).toHaveBeenCalledWith('agent:stateChange', {
    type: 'AgentStateChangeSuccess',
    agentId: 'agent-123',
    state: 'Available',
  });
});
```

Spy on `emit` for events that `handleWebsocketMessage` re-emits and on `trigger` for events forwarded
from `TaskManager` (`task:incoming`, `task:hydrate`); the spec asserts on whichever method the code
calls. Assert the error helper with its exact arguments, for example
`expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'startOutdial', CC_FILE)`; `CC_FILE` is
`'cc'`.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. `yarn test:style` applies the monorepo root
  `.eslintrc.js` to `src/**/*.ts` only; its ignore patterns skip `**/test/**/*`. It enforces
  `max-len` 100, single quotes, `newline-before-return`, and `no-console` (which still allows
  `console.warn` and `console.error`).
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Always use async/await over raw Promises.
- Avoid `any` type unless absolutely necessary, and prefer `unknown` over `any` for unknown types.
  `@typescript-eslint/no-explicit-any` is off, so lint does not catch it; the few justified uses in
  `src/services/task/types.ts` carry an `eslint-disable-next-line` comment.
- TypeScript strict mode is not enabled: the shared root `tsconfig.json` sets `alwaysStrict` but not
  `strict`, so the compiler does not enforce null checks; guard optional data with optional chaining.
- All public APIs must have explicit return types.
- External packages first, then package types/constants, service imports, local utilities, and
  type-only imports (`import type`), as `src/cc.ts` orders them: `@webex/webex-core`, `events`, and
  `uuid`, then `./types` and `./constants`, then `./services` and `./logger-proxy`. New runtime
  dependencies require approval.
- Before adding a literal path, filename, command, workflow identifier, status, or other policy
  value, search the repository for exact and semantically equivalent uses. When repeated production
  values represent one shared contract, move them to the narrowest owning shared module or catalog as
  one canonical named constant, enum, or type and update consumers. Keep incidental similarities,
  one-off implementation details, and independent test fixtures local.
- Do not import a default, named, object, or namespace binding and immediately re-export it.
  Consumers should import from the owning module; `src/index.ts` uses direct named re-exports
  (`export {default as AddressBook} from './services/AddressBook'`).
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.
  Import and reuse the owning guard (`isRecord` in `src/services/core/Utils.ts`) instead; TypeScript
  type-position `typeof` queries remain allowed.

Pattern example:

```text
Preferred:
- Validate input in the public cc or task method before calling a service.
- Return the typed service response; augment failures with getErrorDetails.
- Log with LoggerProxy and {module, method, trackingId}; time and track every operation.

Avoid:
- Passing unvalidated payloads deep into the services.
- Swallowing exceptions, double-logging after getErrorDetails, or synthesizing success.
- Raw event-name strings, console logging, or logging tokens.
```

Before submitting code (each rule lives in the linked subsection):

- All public APIs have JSDoc with `@public`, `@param`, `@returns`, `@example`
  ([Naming and files](#naming-and-files)).
- LoggerProxy used for all logging with module/method context; no `console.log` or `console.error`
  ([Logging, metrics, and errors](#logging-metrics-and-errors)).
- MetricsManager tracks success/failure for all operations
  ([Logging, metrics, and errors](#logging-metrics-and-errors)).
- Error handling follows the `getErrorDetails` pattern
  ([Logging, metrics, and errors](#logging-metrics-and-errors)).
- No hardcoded credentials or sensitive data ([Never](#never)).
- Event constants used (not string literals) ([Events](#events)).
- Method names added to the owning `METHODS` constant ([Services and constants](#services-and-constants)).
- Types exported appropriately ([Public methods and new code placement](#public-methods-and-new-code-placement)).
- Unit tests added/updated ([Testing Workflow](#4-testing-workflow)).
- No `any` types without justification (Coding expectations above).

### Naming and files

Use PascalCase classes/files, camelCase methods, SCREAMING_SNAKE_CASE constants, and typed event
constants from their owning module.

| Element | Convention | Example |
|---|---|---|
| Classes | PascalCase | `ContactCenter`, `TaskManager` |
| Interfaces | PascalCase with `I` prefix for contracts | `IContactCenter`, `ITask`, `IVoice` |
| Types | PascalCase | `SetStateResponse`, `BuddyAgentsResponse` |
| Enums/Constants | SCREAMING_SNAKE_CASE | `CC_EVENTS`, `METRIC_EVENT_NAMES` |
| Methods | camelCase | `stationLogin`, `setAgentState` |
| Private properties | camelCase with `$` prefix for SDK references | `$webex`, `$config` |
| Regular private | camelCase | `agentConfig`, `eventEmitter` |
| Module constants | SCREAMING_SNAKE_CASE | `CC_FILE`, `READY` |

Public value objects that mirror wire values are PascalCase too (`LoginOption`, `VoiceLineStatus`).

| Type | Convention | Example |
|------|------------|---------|
| Class files | PascalCase | `TaskManager.ts`, `WebSocketManager.ts` |
| Type files | lowercase | `types.ts` |
| Constant files | lowercase | `constants.ts` |
| Index files | lowercase | `index.ts` |
| Utility files | PascalCase | `Utils.ts`, `Err.ts` |

Older modules keep kebab-case or camelCase names (`aqm-reqs.ts`, `connection-service.ts`,
`logger-proxy.ts`, `taskDataNormalizer.ts`, `uiControlsComputer.ts`); do not rename them.

JSDoc: all public methods and types must have comprehensive JSDoc with `@public`, `@param`,
`@returns`, `@throws` where the method rejects, and `@example`; typedoc (`yarn build:docs`) renders
them. Mark internals with the `@private` or `@ignore` tag:

```typescript
/**
 * Internal utility function.
 * @private
 * @ignore
 */
private helperMethod(): void {
  // implementation
}
```

```typescript
/**
 * Description of what this type represents.
 * @public
 */
export type MyType = {
  /** Description of this field */
  fieldName: string;
  /** Optional field description */
  optionalField?: number;
};
```

A rejection's reason is the error `message` (see [Logging, metrics, and errors](#logging-metrics-and-errors)),
so document `@throws {Error}` with the reason in `error.message`.

### Logging, metrics, and errors

Logging: use LoggerProxy with module/method context and tracking identifiers; never use console
logging in implementation or log credentials/sensitive data (`console` appears only inside JSDoc
examples).

```typescript
// ✅ REQUIRED pattern
import LoggerProxy from '../../logger-proxy';

LoggerProxy.info('Starting operation', {
  module: 'ModuleName',
  method: 'methodName',
});
```

`LogContext` (`src/types.ts`) has optional `module`, `method`, `interactionId`, `trackingId`, `data`,
and `error` fields. Always pass `module` (the file constant such as `CC_FILE`) and `method` (a
`METHODS` entry); `LoggerProxy.format` writes `unknown` when they are missing. Add `trackingId` for
request correlation, `interactionId` for the task or call, `data` for extra context, and `error` for
error logs. Event handlers log each reception the same way: `handleWebsocketMessage` in `src/cc.ts`
calls `LoggerProxy.log` with `Received event:` plus the event type, `module: CC_FILE`, and
`method: METHODS.HANDLE_WEBSOCKET_MESSAGE`.

| Level | Use Case | Example |
|---|---|---|
| `trace` | Detailed debugging | Entry/exit of complex functions |
| `log` | General information | Operation completed successfully |
| `info` | Important milestones | Starting registration, login |
| `warn` | Potential issues | Non-critical issues that don't break flow: the disabled campaign-preview actions in `src/cc.ts`, an empty dial number in `src/services/core/Utils.ts`; no stack trace |
| `error` | Failures | API errors, exceptions in catch blocks (the default for failure paths); `LoggerProxy.format` appends the stack only at this level, when the context `error` is an `Error` |

Never log sensitive data:

```typescript
// ❌ WRONG
LoggerProxy.log(`User token: ${token}`);

// ✅ CORRECT
LoggerProxy.log('Token received', {
  module: 'Auth',
  method: 'login',
  // No sensitive data in logs
});
```

Errors: preserve structured backend details and tracking ids through shared Core helpers; never
swallow failures or synthesize success. In a catch block, read `const failure = error.details as
Failure`, track the failure metric, then throw the `error` that `getErrorDetails(error, methodName,
moduleName)` returns (task API calls use `generateTaskErrorObject`); its `message` is the backend
reason. Both helpers already log through `LoggerProxy.error` and upload logs (both skipped by
`getErrorDetails` for `AGENT_NOT_FOUND` during `silentRelogin`), so do not double-log errors when
using `getErrorDetails`. The helper contracts and the `Failure` fields are in
[core Caller-visible failure modes](src/services/core/docs/README.md#caller-visible-failure-modes).

Metrics: `MetricsManager.getInstance({webex})` returns the singleton. Start timing at method entry
with `timeEvent([SUCCESS, FAILED])`, then call `trackEvent(name, payload, types)` on the success path
and in the catch block. `types` is a list of `'behavioral'`, `'operational'`, and `'business'`
(default `['behavioral']`). Build payloads with `MetricsManager.getCommonTrackingFieldForAQMResponse`
and `getCommonTrackingFieldForAQMResponseFailed`. Add new events to `src/metrics/constants.ts` inside
`METRIC_EVENT_NAMES`, named with `_SUCCESS` and `_FAILED` suffixes (for example
`FETCH_BUDDY_AGENTS_SUCCESS` / `FETCH_BUDDY_AGENTS_FAILED`) and valued in title case
(`'Fetch Buddy Agents Success'`); a behavioral event also needs its taxonomy in
`src/metrics/behavioral-events.ts`. Details:
[`src/metrics/docs/README.md`](src/metrics/docs/README.md).

Standard public method, as `getBuddyAgents` in `src/cc.ts` implements it:

```typescript
public async getBuddyAgents(data: BuddyAgents): Promise<BuddyAgentsResponse> {
  const {action, state, mediaType = 'telephony'} = data;
  const buddyAgentState = state ?? (action === 'Transfer' ? AGENT_STATE_AVAILABLE : undefined);

  LoggerProxy.info('Fetching buddy agents', {
    module: CC_FILE,
    method: METHODS.GET_BUDDY_AGENTS,
  });
  try {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
      METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED,
    ]);
    const resp = await this.services.agent.buddyAgents({
      data: {
        agentProfileId: this.agentConfig.agentProfileID,
        mediaType,
        ...(buddyAgentState ? {state: buddyAgentState} : {}),
      },
    });

    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp),
        mediaType,
        buddyAgentState,
        buddyAgentCount: resp.data.agentList.length,
      },
      ['operational']
    );

    LoggerProxy.log(`Successfully retrieved ${resp.data.agentList.length} buddy agents`, {
      module: CC_FILE,
      method: METHODS.GET_BUDDY_AGENTS,
      trackingId: resp.trackingId,
    });

    return resp;
  } catch (error) {
    const failureResp = error.details as Failure;

    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResp),
        mediaType,
        buddyAgentState,
      },
      ['operational']
    );
    const {error: detailedError} = getErrorDetails(error, METHODS.GET_BUDDY_AGENTS, CC_FILE);
    throw detailedError;
  }
}
```

When a catch block does not use `getErrorDetails`, at minimum log the error and rethrow:

```typescript
// ❌ WRONG - silently swallowing errors
try {
  await riskyOperation();
} catch (error) {
  // doing nothing
}

// ✅ CORRECT - at minimum log the error
try {
  await riskyOperation();
} catch (error) {
  LoggerProxy.error(`Operation failed: ${error}`, {
    module: 'ModuleName',
    method: 'methodName',
  });
  throw error;
}
```

### Events

Define events as const objects with `as const`:

```typescript
export const MY_EVENTS = {
  SUCCESS: 'MySuccess',
  FAILED: 'MyFailed',
} as const;

// Extract union type
type Enum<T extends Record<string, unknown>> = T[keyof T];
export type MY_EVENTS = Enum<typeof MY_EVENTS>;
```

That is the pattern for WebSocket wire names, where const objects give runtime access to the values:
`CC_EVENTS = {...CC_AGENT_EVENTS, ...CC_TASK_EVENTS}` in `src/services/config/types.ts` (for example `AGENT_STATE_CHANGE: 'AgentStateChange'`). The names
the SDK emits to applications are TypeScript enums: `AGENT_EVENTS` in `src/services/agent/types.ts`
(`'agent:stateChange'`, `'agent:stationLoginSuccess'`, ...), `TASK_EVENTS` in
`src/services/task/types.ts` (`'task:incoming'`, `'task:hydrate'`, `'task:autoAnswered'`, ...), and
`VOICE_CONNECTION_EVENTS` in `src/services/config/types.ts`.

Always use event constants:

```typescript
import {AGENT_EVENTS} from './services/agent/types';

// ✅ CORRECT
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);

// ❌ WRONG
this.emit('stateChange', eventData);
```

There are two methods for emitting events, `trigger` and `emit`, and which one to use depends on what
the class extends:

| Class extends | Method | `@ts-ignore` needed? | Example classes |
|---------------|--------|----------------------|-----------------|
| `WebexPlugin` | `trigger` | Yes | `cc.ts` (ContactCenter) |
| `EventEmitter` | `emit` | No | Task, TaskManager, WebCallingService, WebSocketManager, ConnectionService |

`ContactCenter` extends `WebexPlugin`, whose Ampersand events mixin aliases `emit` to `trigger`; the
typings expose neither, so both need `// @ts-ignore` on `cc`. `src/cc.ts` uses `trigger` for events it
forwards from `TaskManager` and `WebCallingService` (`handleIncomingTask`, `handleTaskHydrate`,
`handleVoiceConnectionStateChange`) and `emit` in `handleWebsocketMessage` for agent events and the
wellness break. For new code on the `cc` object, use `trigger`, and keep an existing call's method,
because the specs spy on it.

Always store the callback as a named function reference; inline anonymous functions make it
impossible to call `.off()`. Prefer arrow function properties (`handleWebsocketMessage`, `handleIncomingTask`), which keep `this` and one
reference; a `.bind(this)` at registration creates a reference that `off()` cannot match. The known
listener-cleanup defects are recorded in
[Pitfalls and constraints](src/docs/README.md#pitfalls-and-constraints).

Internal services listen to each other: the constructor's `this.$webex.once(READY, ...)` block
registers the `TaskManager` listeners (`incomingTaskListener()`), `register()` registers the WebSocket
`message` listener and, through `setupEventListeners()`, the `connectionLost` listener, and
`deregister()` removes them. Always clean up resources: every `on()` must have a corresponding `off()`
in the deregister/cleanup path, and an open socket is closed only after checking `isSocketClosed`:

```typescript
public async deregister(): Promise<void> {
  // Remove event listeners
  this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
  this.services.webSocketManager.off('message', this.handleWebsocketMessage);

  // Close connections
  if (!this.services.webSocketManager.isSocketClosed) {
    this.services.webSocketManager.close(false, 'Unregistering the SDK');
  }

  // Clear state
  this.agentConfig = null;
}
```

Applications subscribe on the `cc` object or on task instances. Always use named callbacks so `.off()`
can reference the same function:

```typescript
const cc = webex.cc;

// Define named callbacks (required for .off() to work)
const handleStateChange = (event) => {
  // handle agent state change
};

const handleLoginSuccess = (event) => {
  // handle login success
};

const handleIncomingTask = (task) => {
  // handle incoming task
};

// Subscribe — agent events (from cc)
cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE, handleStateChange);
cc.on(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, handleLoginSuccess);

// Subscribe — task events (from cc)
cc.on(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);

// Unsubscribe — pass the same function reference
cc.off(AGENT_EVENTS.AGENT_STATE_CHANGE, handleStateChange);
cc.off(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, handleLoginSuccess);
cc.off(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);
```

Events flow through a standard pipeline: receive from transport, parse, log, route, and emit to
listeners. For `cc`, the Register and Recovery flows in
[`src/docs/README.md`](src/docs/README.md#data-flow-and-sequence-coverage) and its
[Protocol and wire format](src/docs/README.md#protocol-and-wire-format) (the `CC_EVENTS` allow-list)
own the details; the WebSocket transport is in
[`src/services/core/docs/README.md`](src/services/core/docs/README.md#data-flow-and-sequence-coverage).

To add a new event:

1. Add the wire constant to the matching `CC_*_EVENTS` object in `src/services/config/types.ts`; it
   joins `CC_EVENTS`, and therefore the re-emit allow-list, through the spread.
2. Add the application-facing name to `AGENT_EVENTS` (`'agent:...'`) or `TASK_EVENTS` (`'task:...'`).
3. Handle it in `handleWebsocketMessage` (agent events) or the task WebSocket handling in
   `TaskManager`, using the method rule above.
4. Document it in the emitting method's JSDoc and export any new payload type from `src/index.ts`.

### Services and constants

Services use singleton pattern via `Services` class:

```typescript
// Access services through Services singleton
this.services = Services.getInstance({
  webex: this.$webex,
  connectionConfig: this.getConnectionConfig(),
});

// Use services
await this.services.agent.stationLogin({data});
await this.services.config.getAgentConfig(orgId, agentId);
```

`Services` (`src/services/index.ts`) holds `agent` (`routingAgent`), `config` (`AgentConfigService`),
`contact` (`src/services/task/contact.ts`), `dialer` (`src/services/task/dialer.ts`),
`webSocketManager`, `rtdWebSocketManager`, and `connectionService`. `ContactCenter` builds it, the
`TaskManager` and `MetricsManager` singletons, and the single-file services inside its
`this.$webex.once(READY, ...)` block; non-AQM services are instantiated directly in `cc.ts`. Details:
[`src/services/docs/README.md`](src/services/docs/README.md).

Agent/contact services use factory pattern: an AQM service is a function of `AqmReqs` that returns
`routing.req` (or `routing.reqEmpty`) request definitions. The real `stateChange` in
`src/services/agent/index.ts`:

```typescript
stateChange: routing.req((p: {data: Agent.StateChange}) => ({
  url: '/v1/agents/session/state',
  host: WCC_API_GATEWAY,
  data: p.data,
  err,
  method: HTTP_METHODS.PUT,
  notifSuccess: {
    bind: {
      type: CC_EVENTS.AGENT_STATE_CHANGE,
      data: {type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS},
    },
    msg: {} as Agent.StateChangeSuccess,
  },
  notifFail: {
    bind: {
      type: CC_EVENTS.AGENT_STATE_CHANGE,
      data: {type: CC_EVENTS.AGENT_STATE_CHANGE_FAILED},
    },
    errId: 'Service.aqm.agent.stateChange',
  },
})),
```

`method` is optional: `aqm-reqs.ts` defaults to POST when `data` is present and GET otherwise.
`notifSuccess.bind` and `notifFail.bind` match the WebSocket message `type` and `data.type` that settle
the promise, and `errId` names the `Err.Details` failure. The flow is HTTP request, backend
processing, then the WS message: `aqm-reqs` resolves or rejects the promise from that message, and
`cc.ts` `handleWebsocketMessage()` receives the same message and emits the matching `AGENT_EVENTS`
name. `getBuddyAgents` works the same way: its result is the `BuddyAgents` WebSocket
message, not the HTTP response. Methods that call REST directly (`AgentConfigService`, the single-file
services) use `WebexRequest`.

Single-file REST services (`AddressBook.ts`, `EntryPoint.ts`, `Queue.ts`, `UserPreference.ts`) use
`WebexRequest.getInstance({webex})` for HTTP calls (not raw `webex.request`), `PageCache` for
pagination, and `MetricsManager` for tracking. Their constructor takes `webex` and, for a profile
dependency, a getter, as in `new AddressBook(this.$webex, () => this.agentConfig?.addressBookId)`.
They export the class both named and as default. Study `src/services/AddressBook.ts` or
`src/services/EntryPoint.ts` as the reference implementation for a new REST service.

| Placement | Integration point | Types location | Constants location |
|---|---|---|---|
| **Folder-based** | `cc.ts` or `Services` singleton | Service folder's `types.ts` | Service folder's `constants.ts` |
| **Single-file** | `cc.ts` directly | Root `src/types.ts` | `src/services/constants.ts` |
| **Sub-module** | Parent service | Parent's `types.ts` | Parent's `constants.ts` |

Single-file service types such as `AddressBookEntry`, `EntryPointRecord`, and `ContactServiceQueue`
are defined in root `src/types.ts`; some live elsewhere (`UserPreference` types are in
`src/services/config/types.ts`).

Folder-based services are `agent/` (`index.ts` and `types.ts`), `config/` (`index.ts`, `types.ts`,
`constants.ts`, `Util.ts`), `core/`, and `task/`; sub-modules are files inside a service folder, such
as `task/voice/Voice.ts` and `task/digital/Digital.ts`, which `TaskFactory` instantiates.

Constants hierarchy (search in this order before adding one):

| Level | File | What lives here | Examples |
|---|---|---|---|
| **Root** | `src/constants.ts` | SDK-wide file names, method names, global settings | `CC_FILE`, `TASK_FILE`, `READY`, `METHODS`, `TIMEOUT_DURATION` |
| **Services shared** | `src/services/constants.ts` | API gateways, auth, network constants shared across services | `WCC_API_GATEWAY`, `POST_AUTH`, `WEBSOCKET_EVENT_TIMEOUT` |
| **Metrics** | `src/metrics/constants.ts` | All metric event names | `METRIC_EVENT_NAMES` (single object with all events) |
| **Config** | `src/services/config/constants.ts` | Endpoint maps, pagination defaults, agent states | `endPointMap`, `DEFAULT_PAGE_SIZE`, `AGENT_STATE_AVAILABLE` |
| **Core** | `src/services/core/constants.ts` | Transport timeouts and keepalive settings | `TIMEOUT_REQ`, `KEEPALIVE_WORKER_INTERVAL` |
| **Service-specific** | `src/services/task/constants.ts` | Constants used only within that service | `TASK_API`, `HOLD`, `TIMEOUT_PREVIEW_ACCEPT` |

Before defining any new constant, search the existing constants hierarchy to check if it already
exists or belongs at a shared level; duplicates or a constant at the wrong level create drift. For
each constant: grep for the constant name or value across all `constants.ts` files; if found,
import from that file and do not redefine it; if not found, add it at the narrowest correct level.
Create a new `constants.ts` only for a folder-based service that has none and has constants that do
not belong at a shared level (`agent/` has none). `TASK_FILE` already exists twice, in
`src/constants.ts` (`'Task'`) and `src/services/task/constants.ts` (`'task'`); `METHODS` exists per
level (root, config, core, task), so add a method name to the `METHODS` of the file whose module
logs it.

### Public methods and new code placement

- The public method lives on the object that owns the feature's scope: `cc` (`src/cc.ts`) for
  SDK-level operations (`cc.stationLogin()`, `cc.setAgentState()`), `task` for per-interaction
  operations (`task.hold()`, `task.transfer()`, `task.end()`). New public objects may be introduced in
  the future. If the feature is internal to a service or only consumed by other services, it gets no
  public method.
- A public method is either a public wrapper over an internal service call, where the
  implementation lives in a service module and the public method delegates to it (`cc.getBuddyAgents`
  calls `this.services.agent.buddyAgents` with `agentProfileId` from `this.agentConfig`), or a public
  service accessor. Use the public service accessors on `cc` (`cc.addressBook.getEntries()`,
  `cc.queue.getQueues()`), not `cc.services`, which is private; `entryPoint` is private and reached
  through the `cc.getEntryPoints()` wrapper.
- Task methods are defined on `Task` (`src/services/task/Task.ts`) and overridden per channel in
  `Voice`, `WebRTC`, and `Digital`; the base method calls `unsupportedMethodError` for a channel that
  does not support it (`Voice.hold()` delegates to `holdResume()`, which calls `this.contact.hold`).
- Feature placement: extend an existing service when the feature naturally extends current service
  responsibility, needs only 1-2 methods in the same domain, or the service already owns the required
  events, state, or API integration. Create a new service or module when the feature introduces a
  distinct domain boundary/responsibility, needs its own lifecycle, dependencies, or state
  orchestration, is expected to grow into multiple related methods/classes, or would create low
  cohesion or cross-domain coupling in an existing service.
- Emit events only when consumers need to react asynchronously to state changes (WS-driven methods
  like `stationLogin`, `setAgentState`); for a request-response method, the returned Promise is
  sufficient.
- Types: public types (what consumers see) go in `src/types.ts`; internal/service types (with extra
  fields like `agentProfileId`) go in `src/services/[service]/types.ts`. For example the public
  `BuddyAgents` in `src/types.ts` has optional `mediaType`, `state`, and `action`, while
  `src/services/agent/types.ts` `BuddyAgents` adds the required `agentProfileId`;
  `BuddyAgentsResponse` is `Agent.BuddyAgentsSuccess | Error`. A type is published only when
  `src/index.ts` exports it (`export type {...} from './types'` or from a service `types.ts`).
- A new top-level public service is a `public` property on `ContactCenter` with JSDoc, created in the
  `this.$webex.once(READY, ...)` block; an AQM service is a new `Services` member created from
  `aqmReq`; a sub-module is created by its parent.

### Common bug patterns

Trace the execution flow along the call chain plugin → service → core, find where behavior diverges
from the expected behavior, and check whether existing tests should have caught it.

- Async/Promise issues: a service call that is not awaited (`await this.services.agent.stateChange({data})`).
- Missing error handling: an empty `catch`; route it through `getErrorDetails` and rethrow.
- Event listener leaks: a listener registered without a stored reference or without a matching
  `off()` (see [Events](#events)).
- Type mismatches: reading the wrong property of a response; check the actual response type (AQM
  responses such as `StationLoginSuccess` are `Msg` envelopes with the payload under `data`, while
  emitted event payloads are that inner `data`).
- Missing null checks: the compiler does not enforce them, so use optional chaining
  (`this.agentConfig?.teams?.[0]?.name`).

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results, including the coverage summary.
- Risk and impact on applications that use `webex.cc`, task objects, the published types, and the
  `umd/contact-center.min.js` bundle.
- Rollback approach.

### Review checks

Run by a runtime different from the generator. Findings remain drafts until explicitly published.

| # | Check | What it verifies | Severity if it fails |
|---|---|---|---|
| C1 | Spec-currency + WHAT/WHY | Specs/docs and code land together; every requirement states WHAT and WHY | Blocking |
| C2 | Contract correctness | Provides/Requires and public API/event/type deltas are complete | Blocking |
| C3 | Code-vs-spec match | Signatures, flows, states, timeouts, and architecture match code | Blocking |
| C4 | Test adequacy | Positive/negative cases and 85% package threshold | Important |
| C5 | Error handling/input validation | Structured failures, tracking ids, validation, no swallowed errors | Important |
| C6 | Security baseline | Host auth, no secrets/sensitive logs, safe transport mapping | Blocking |

| # | Check | When it applies | What it verifies | Severity |
|---|---|---|---|---|
| K1 | Regression guard | Partial module or modified/removed guarantee | Characterization and invariants | Blocking |
| K2 | Grounding | Partial module | Stable file-path evidence; code cross-check | Important |
| K3 | Drift threshold | Any tracked module | Drift remains within policy | Important |
| K4 | Coverage-state accuracy | Promotion/demotion | Status matches evidence | Medium |

| # | Check | What it verifies | Severity |
|---|---|---|---|
| X1 | Cross-runtime review | Validator runtime differs from the generator runtime recorded in the manifest `validation` block | Blocking |
| X2 | Observability | LoggerProxy/metrics adequate; no sensitive logging | Medium |
| X3 | Rollout safety | Defaults, compatibility, rollback/recovery safe | Important |

1. Run all six core checks.
2. Add K1–K4 for current Partial modules.
3. Add X1–X3 for high-risk, contract, security, state, transport, or autonomous changes.

Output: a compliance matrix, severity-sorted findings, and a Pass / Pass-with-warnings / Blocked
verdict. Draft only.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Read-only inspection and approved low-risk documentation maintenance may proceed without asking.
- Update the owning module spec and contract catalog in the same change as behavior, contracts,
  state, events, or public types.
- Partial modules require code cross-checking and characterization before risky changes.
- Load this file, the router, and only the affected module specs; stop on a blocking contract,
  security, source-fidelity, conformance, or validation finding. Generated specs require review by the
  manifest-configured independent runtime.
- When a new service folder needs its own spec, add it as a manifest module with its spec at the
  module's `docs/README.md` and route it from `docs/specs/README.md` (ask first).
- Add a rule here when a review correction recurs; remove duplication when tooling enforces it.

### Ask First

- Code changes, public contract changes, state-machine changes, security-sensitive work, or new
  dependencies.
- Breaking changes to existing APIs (method signatures, event names, `src/index.ts` exports, type
  fields), with the migration path.
- Changing AQM bindings, timeouts, or retry and relogin behavior (`allowAutomatedRelogin`,
  `TIMEOUT_REQ`).
- Renaming or revaluing a `METRIC_EVENT_NAMES` entry, which changes reported telemetry.
- Running `yarn test:e2e`, which drives live Contact Center tenants with credentials from the
  monorepo-root `cc_playwright/.env`.
- Large refactors, and any destructive data or infrastructure operation.

### Never

- Push, publish, deploy, delete, or post externally without explicit human approval.
- Commit secrets, keys, or credentials: API keys, tokens, secrets; passwords or authentication data;
  private keys or certificates. No hardcoded secrets, tokens, keys, or connection strings; never log
  them.
- Bypass required checks by disabling tests or linters, or lower the coverage threshold.
- Edit `dist/` or `umd/` by hand.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
