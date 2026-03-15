# New Module - Validation Checklist

> **Purpose**: Comprehensive quality gate for a new module to ensure it follows all calling package conventions.

---

## Pre-Validation

Before running through this checklist, ensure:
- Module code generated from [`02-code-generation.md`](02-code-generation.md)
- Tests generated from [`03-test-generation.md`](03-test-generation.md)

---

## 1. File Structure

- [ ] Module directory follows naming convention: `src/ModuleName/`
- [ ] Main class file: `ModuleName.ts` (PascalCase)
- [ ] Type definitions: `types.ts`
- [ ] Constants: `constants.ts`
- [ ] Test file: `ModuleName.test.ts` (co-located)
- [ ] Fixture file: `fixtures.ts` or `moduleNameFixtures.ts`
- [ ] Backend connectors (if multi-backend): `WxCallBackendConnector.ts`, `UcmBackendConnector.ts`, etc.

---

## 2. TypeScript Quality

### Types
- [ ] Interface defined with `I` prefix (`IModuleName`)
- [ ] Interface extends `Eventing<T>` if module emits events
- [ ] All public methods declared in the interface
- [ ] All method parameters have explicit types
- [ ] All methods have explicit return types
- [ ] No `any` types (use `unknown` with narrowing)
- [ ] Types use PascalCase naming
- [ ] Enums use PascalCase name with SCREAMING_SNAKE_CASE values

### Constants
- [ ] File name constant for logging: `MODULE_NAME_FILE`
- [ ] API endpoints as constants
- [ ] Timing values as constants (not magic numbers)
- [ ] Constants use SCREAMING_SNAKE_CASE

### JSDoc
- [ ] Class has JSDoc description
- [ ] Constructor has JSDoc with `@param` tags
- [ ] All public methods have JSDoc with:
  - [ ] Description
  - [ ] `@param` for each parameter
  - [ ] `@returns` description
  - [ ] `@example` with code snippet

---

## 3. Pattern Compliance

### Logging
- [ ] Logger imported: `import log from '../Logger'`
- [ ] Logger initialized in constructor (if config has logger level)
- [ ] Every public method logs at entry: `log.info('message', { file, method })`
- [ ] Every error path logs: `log.error('message', { file, method })`
- [ ] File constant used for `file` context
- [ ] No `console.log/warn/error` anywhere

### Metrics
- [ ] MetricManager obtained via `getMetricManager()`
- [ ] Success metrics submitted for operations
- [ ] Failure metrics submitted for operations
- [ ] Correct `METRIC_EVENT` enum values used
- [ ] New `METRIC_EVENT` entries added if needed

### Error Handling
- [ ] Appropriate error class used (CallError, LineError, CallingClientError)
- [ ] Errors created via factory functions
- [ ] Error context includes `{ file, method }`
- [ ] Error events emitted to consumers (if applicable)
- [ ] No swallowed errors
- [ ] try/catch around all async operations

### Events (if applicable)
- [ ] Event key enum defined or extended in `src/Events/types.ts`
- [ ] Event type map defined with typed callbacks
- [ ] Events emitted using enum constants (not string literals)
- [ ] Event payloads match type map definitions

### SDK Integration
- [ ] SDKConnector used for Webex SDK access
- [ ] `webex.request<T>()` used for API calls
- [ ] `addAuthHeader: true` on authenticated requests
- [ ] `HTTP_METHODS` enum used (not string literals)

---

## 4. Exports

- [ ] Interface exported from `src/api.ts`
- [ ] Class exported from `src/api.ts`
- [ ] Factory function exported from `src/api.ts`
- [ ] Public types exported from `src/api.ts`
- [ ] Import paths are correct

---

## 5. Tests

### Structure
- [ ] Test file is co-located with source
- [ ] Logger is mocked
- [ ] Webex is mocked via `getTestUtilsWebex()`
- [ ] `beforeEach` clears mocks
- [ ] `afterEach` restores mocks

### Coverage
- [ ] Initialization tested (factory function, config options)
- [ ] Each public method has success test
- [ ] Each public method has error test
- [ ] Edge cases tested (empty responses, optional params)
- [ ] Event emission tested (if applicable)
- [ ] Logger calls verified
- [ ] Metric submissions verified (if applicable)
- [ ] Backend connector tests (if multi-backend)

### Execution
- [ ] All tests pass: `yarn test:unit`
- [ ] No existing tests broken

---

## 6. Build & Lint

```bash
yarn build           # TypeScript compilation
yarn test:unit       # All tests pass
yarn test:style      # ESLint passes
```

- [ ] Build passes without errors
- [ ] Tests pass without failures
- [ ] Lint passes without errors

---

## 7. Documentation

- [ ] Module appears in root `AGENTS.md` module routing table
- [ ] Module appears in `ai-docs/README.md` module table
- [ ] `ai-docs/AGENTS.md` created for the module (if non-trivial)
- [ ] `ai-docs/ARCHITECTURE.md` created (if module has complex internals)

---

## Validation Summary

| Category | Status | Notes |
|---|---|---|
| File Structure | Pass / Fail | |
| TypeScript Quality | Pass / Fail | |
| Pattern Compliance | Pass / Fail | |
| Exports | Pass / Fail | |
| Tests | Pass / Fail | |
| Build & Lint | Pass / Fail | |
| Documentation | Pass / Fail | |

**Overall**: Ready to merge / Needs fixes

---

## Common Issues

| Issue | Fix |
|---|---|
| Missing Logger mock in tests | Add `jest.mock('../Logger', ...)` at top of test file |
| `any` type warnings | Replace with `unknown` and add type narrowing |
| Import order lint errors | Follow 3-tier order: external → internal → relative |
| Missing JSDoc | Add `@param`, `@returns`, `@example` to all public methods |
| String literal events | Replace with enum constants from `src/Events/types.ts` |
| Console.log in code | Replace with Logger module methods |
