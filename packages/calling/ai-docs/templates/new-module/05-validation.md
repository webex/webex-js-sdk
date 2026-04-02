# Validation

Run through every checklist below before declaring the module complete. Each section must pass fully.

---

## 1. Service Class Checklist

- [ ] Class extends `Eventing<ModuleNameEventTypes>` (if events) or standalone class (if no events)
- [ ] Class implements `IModuleName` interface
- [ ] Constructor follows the standard pattern:
  - [ ] Assigns `this.sdkConnector = SDKConnector`
  - [ ] Guards `SDKConnector.setWebex(webex)` with `if (!this.sdkConnector.getWebex())`
  - [ ] Assigns `this.webex = this.sdkConnector.getWebex()`
  - [ ] Calls `log.setLogger(logger.level, MODULE_NAME_FILE)`
  - [ ] Registers Mercury listeners (if applicable)
  - [ ] Initializes MetricManager (if applicable): `this.metricManager = getMetricManager(this.webex, undefined)`
  - [ ] Initializes backend connector (if multi-backend)
- [ ] Every public method has:
  - [ ] A `loggerContext` object with `file` and `method` fields
  - [ ] `log.info(METHOD_START_MESSAGE, ...)` at the start
  - [ ] `log.log(...)` on success with tracking ID
  - [ ] `log.error(...)` on failure
  - [ ] `await uploadLogs()` in the error path
  - [ ] `serviceErrorCodeHandler(errorInfo, loggerContext)` for error response construction
- [ ] Factory function is exported: `export const createModuleNameClient = (...) => new ModuleName(...)`
- [ ] JSDoc comments on the class and all public methods

---

## 2. Types and Constants Checklist

### Types (`types.ts`)

- [ ] `LoggerInterface` is defined with `level: LOGGER`
- [ ] `IModuleName` interface is defined with all public methods
- [ ] Response types follow `{ statusCode: number; data: {...}; message: string | null }` shape
- [ ] All interface methods have JSDoc with `@param`, `@returns`, and `@example`

### Constants (`constants.ts`)

- [ ] Module file constant is defined (e.g., `MODULE_NAME_FILE = 'ModuleName'`)
- [ ] `METHODS` object has entries for all public and significant private methods
- [ ] No constants duplicate values already defined in shared locations

### Hierarchy Verification

Verify constants are placed at the correct level:

| Constant | Should Be In | Reason |
|----------|-------------|--------|
| `SUCCESS_MESSAGE` | `src/common/constants.ts` | Already exists -- DO NOT redeclare |
| `FAILURE_MESSAGE` | `src/common/constants.ts` | Already exists -- DO NOT redeclare |
| `METHOD_START_MESSAGE` | `src/common/constants.ts` | Already exists -- DO NOT redeclare |
| `STATUS_CODE` | `src/common/constants.ts` | Already exists -- DO NOT redeclare |
| `MODULE_NAME_FILE` | `src/ModuleName/constants.ts` | Module-specific |
| `METHODS` | `src/ModuleName/constants.ts` | Module-specific |
| Event key enums | `src/Events/types.ts` | Shared event system |
| Metric events/actions | `src/Metrics/types.ts` | Shared metric system |

---

## 3. Metrics Checklist

- [ ] Metric event names are added to `METRIC_EVENT` enum in `src/Metrics/types.ts` (if applicable)
- [ ] Metric action enum is defined (if applicable)
- [ ] `submitMetric` helper method is implemented on the service class (if applicable)
- [ ] Metrics are submitted for both success and error paths
- [ ] Metric event names follow the naming convention: `web-calling-sdk-{module-name}` and `web-calling-sdk-{module-name}-error`

---

## 4. Integration Checklist

- [ ] Module is exported from `src/api.ts`:
  - [ ] Class export
  - [ ] Interface export
  - [ ] Factory function export
  - [ ] Response type exports (if consumer-facing)
- [ ] Event types are defined in `src/Events/types.ts` (if applicable):
  - [ ] Event key enum
  - [ ] Event type map (`ModuleNameEventTypes`)
  - [ ] Mercury event keys in `MOBIUS_EVENT_KEYS` (if module listens to Mercury)
- [ ] Mercury listeners are registered in the constructor (if applicable)
- [ ] No circular imports

---

## 5. Tests Checklist

- [ ] Test file is co-located with source (same directory)
- [ ] Uses `getTestUtilsWebex()` for mock webex
- [ ] Logger spies are set up: `info`, `log`, `error`
- [ ] `uploadLogs` is mocked
- [ ] **Initialization tests:**
  - [ ] Factory function creates a valid instance
  - [ ] Class can be instantiated directly
- [ ] **Success tests for each public method:**
  - [ ] Correct status code returned
  - [ ] Response data is correctly shaped
  - [ ] Logger `info` and `log` were called
  - [ ] Logger `error` was NOT called
  - [ ] `uploadLogs` was NOT called
- [ ] **Error tests for each public method:**
  - [ ] 400 status code handled
  - [ ] 401 status code handled
  - [ ] 404 status code handled
  - [ ] Logger `error` was called with correct context
  - [ ] `uploadLogs` was called
- [ ] **Event tests (if applicable):**
  - [ ] `emit` called with correct event key for valid payloads
  - [ ] `emit` NOT called for undefined/null payloads
  - [ ] `emit` NOT called for malformed payloads
- [ ] **Backend connector tests (if multi-backend):**
  - [ ] Each connector tested independently
  - [ ] Correct connector instantiated per backend type
  - [ ] Invalid backend throws error
- [ ] **Fixture file exists** with mock data for all test scenarios

---

## 6. Pattern Compliance

Verify the code follows the established patterns. Below are correct and incorrect examples for common patterns.

### Logger Import

```typescript
// CORRECT:
import log from '../Logger';

// INCORRECT:
import Logger from '../Logger';          // Wrong name
import {log} from '../Logger';           // Wrong import style (not named export)
import log from '../Logger/index';       // Unnecessary path
```

### Logger Context

```typescript
// CORRECT:
const loggerContext = {
  file: MODULE_NAME_FILE,
  method: METHODS.GET_DATA,
};
log.info(`${METHOD_START_MESSAGE} with param=${param}`, loggerContext);

// INCORRECT:
log.info(`invoking getData`);                    // Missing context object
log.info('invoking', {file: 'ModuleName'});      // Missing method field
log.info(METHOD_START_MESSAGE, 'ModuleName');     // Context must be an object
```

### Error Handling

```typescript
// CORRECT:
try {
  const response = <WebexRequestPayload>await this.webex.request({...});
  // ... process response ...
  return responseDetails;
} catch (err: unknown) {
  log.error(`Failed to get data: ${JSON.stringify(err)}`, loggerContext);
  await uploadLogs();
  const errorInfo = err as WebexRequestPayload;
  const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);
  return errorStatus;
}

// INCORRECT:
try {
  // ...
} catch (err) {                        // Missing `: unknown` type annotation
  console.error(err);                   // Using console instead of log
  throw err;                            // Not using serviceErrorCodeHandler for API errors
}

// INCORRECT:
try {
  // ...
} catch (err: unknown) {
  log.error(`Error: ${err}`, loggerContext);   // Not using JSON.stringify
  return {statusCode: 500, message: 'error'}; // Hand-built error instead of serviceErrorCodeHandler
}
```

### Event Constants

```typescript
// CORRECT (in src/Events/types.ts):
export enum COMMON_EVENT_KEYS {
  MODULE_NAME_DATA_UPDATE = 'moduleName:data_update',
}

// INCORRECT (in src/ModuleName/constants.ts):
export const DATA_UPDATE_EVENT = 'moduleName:data_update';   // Event keys belong in Events/types.ts
```

### Type Exports

```typescript
// CORRECT (in src/api.ts):
import {IModuleName} from './ModuleName/types';
export {IModuleName};

// INCORRECT:
export {IModuleName} from './ModuleName/ModuleName';   // Types should come from types.ts
```

### SDKConnector Usage

```typescript
// CORRECT:
this.sdkConnector = SDKConnector;
if (!this.sdkConnector.getWebex()) {
  SDKConnector.setWebex(webex);
}
this.webex = this.sdkConnector.getWebex();

// INCORRECT:
this.webex = webex;                    // Bypassing SDKConnector
SDKConnector.setWebex(webex);          // Missing guard -- will throw if already set
```

### Factory Function

```typescript
// CORRECT:
export const createModuleNameClient = (
  webex: WebexSDK,
  logger: LoggerInterface
): IModuleName => new ModuleName(webex, logger);

// INCORRECT:
export function createModuleNameClient(webex, logger) {   // Missing types, using function declaration
  return new ModuleName(webex, logger);
}
```

---

## 7. Build and Test Commands

Run these commands from the calling package directory (`packages/calling/`):

> If scripts ever drift, validate command names against `packages/calling/package.json` before finalizing validation instructions.

### Build

```bash
# Build the package to verify compilation:
yarn build

# Or use the workspace command from repo root:
yarn workspace @webex/calling build
```

### Lint

```bash
# Run ESLint:
yarn test:style

# Or from repo root:
yarn workspace @webex/calling test:style
```

### Test

```bash
# Run all tests:
yarn test:unit

# Run only the new module's tests:
cd packages/calling 
npx jest src/ModuleName/

# Run with coverage:
cd packages/calling 
npx jest src/ModuleName/ --coverage

# Run a single test file:
cd packages/calling 
npx jest src/ModuleName/ModuleName.test.ts --verbose
```

### Verify All Pass

- [ ] `yarn build` completes without errors
- [ ] `yarn test:style` completes without errors (or only pre-existing warnings)
- [ ] `yarn test:unit` passes all tests
- [ ] `npx jest src/ModuleName/ --coverage` shows adequate coverage for new code

---

## 8. Documentation

### Update AGENTS.md Module Routing Table

Add the new module to the Module Index table in root `AGENTS.md` (`packages/calling/AGENTS.md`):

```markdown
| **ModuleName** | `ModuleName` | `createModuleNameClient()` | `IModuleName` | {one-sentence description} |
```

### Update README.md (if applicable)

If the package has a consumer-facing README, add the new module to the list of available modules and provide a usage example:

```typescript
import {createModuleNameClient} from '@webex/calling';

const client = createModuleNameClient(webex, {level: 'info'});
const response = await client.getData(params);
```

### Create Module ai-docs (recommended)

For significant modules, create an `ai-docs/` folder within the module directory:

```
src/ModuleName/ai-docs/
  AGENTS.md         # Module purpose, capabilities, behavior
  ARCHITECTURE.md   # API details, data flow, backend specifics
```

---

## 9. Final Review

Answer these self-check questions before completing:

1. **Can a consumer create an instance?**
   `const client = createModuleNameClient(webex, {level: 'info'});` should work without errors.

2. **Can a consumer call every public method?**
   Each method in `IModuleName` should be callable and return the documented response type.

3. **Can a consumer listen for events?**
   If the module emits events: `client.on(EVENT_KEY, handler)` should work with correct TypeScript types.

4. **Does the module log correctly?**
   Every method should produce `log.info` on entry and `log.log` on success or `log.error` on failure.

5. **Does the module handle errors gracefully?**
   No unhandled promise rejections. All API errors are caught and returned as structured error responses.

6. **Does the module follow the multi-backend pattern correctly?**
   If multi-backend: the facade delegates to the correct connector, and invalid backends throw descriptive errors.

7. **Are all tests passing?**
   `npx jest src/ModuleName/` should exit with code 0.

8. **Is the module discoverable?**
   It appears in `src/api.ts` exports and in the root `AGENTS.md` routing table.

---

## Completion

When all checklists pass and all self-check questions are answered affirmatively, the module is complete. Report back to the user with:

1. List of files created/modified
2. Summary of the module's public API
3. Instructions for running tests
4. Any known limitations or follow-up items
