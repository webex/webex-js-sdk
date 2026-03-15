# New Method - Validation Checklist

> **Purpose**: Quality gate to verify the new method follows all calling package conventions.

---

## Pre-Validation

Before running through this checklist, ensure:
- Method is implemented (from [`02-implementation.md`](02-implementation.md))
- Tests are written (from [`03-tests.md`](03-tests.md))

---

## 1. Code Quality

### TypeScript
- [ ] No `any` types (use `unknown` with type narrowing)
- [ ] Explicit return type on the method signature
- [ ] All parameters have types
- [ ] New types defined in `types.ts`
- [ ] New constants defined in `constants.ts`

### JSDoc
- [ ] `@param` for every parameter
- [ ] `@returns` with return description
- [ ] `@example` with usage code snippet
- [ ] `@public` tag if it's a public API method

### Naming
- [ ] Method name follows camelCase convention
- [ ] Parameter names are descriptive
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] Types use PascalCase

---

## 2. Pattern Compliance

### Logging
- [ ] `log.info()` called at method entry with descriptive message
- [ ] `log.error()` called on every error path
- [ ] Logger context includes `{ file: FILE_CONSTANT, method: METHOD_CONSTANT }`
- [ ] No `console.log/warn/error` anywhere

### Metrics
- [ ] Success metric submitted via MetricManager
- [ ] Failure metric submitted via MetricManager
- [ ] Correct `METRIC_EVENT` enum values used
- [ ] Correct `METRIC_TYPE` (OPERATIONAL or BEHAVIORAL)

### Error Handling
- [ ] Correct error class used (CallError, LineError, or CallingClientError)
- [ ] Error created via factory function (createCallError, createLineError, createClientError)
- [ ] Error context includes `{ file, method }`
- [ ] Error event emitted to consumers
- [ ] No swallowed errors

### Events (if applicable)
- [ ] Event key added to appropriate enum in `src/Events/types.ts`
- [ ] Typed callback added to event type map
- [ ] Event emitted using enum constant (not string literal)
- [ ] Event payload matches the type map definition

---

## 3. Interface Compliance

- [ ] If public: method added to the module's interface (`ICallingClient`, `ICall`, `ILine`, etc.)
- [ ] If public: types exported from `src/api.ts`
- [ ] Method signature in interface matches implementation

---

## 4. Tests

### Coverage
- [ ] Success path tested
- [ ] Error path tested
- [ ] Edge cases tested (optional params, invalid input, precondition failures)
- [ ] Event emission tested (if applicable)
- [ ] Logger calls verified
- [ ] Metric submissions verified

### Execution
- [ ] All new tests pass: `yarn test:unit`
- [ ] No existing tests broken
- [ ] Test file is co-located with source

---

## 5. Build & Lint

```bash
# Run these commands to verify
yarn build           # TypeScript compilation succeeds
yarn test:unit       # All tests pass
yarn test:style      # ESLint passes
```

- [ ] Build passes without errors
- [ ] Tests pass without failures
- [ ] Lint passes without errors

---

## 6. Documentation

- [ ] Module's `ai-docs/AGENTS.md` updated with new method (if module has ai-docs)
- [ ] Module's `ai-docs/ARCHITECTURE.md` updated if architecture changed
- [ ] Method appears in API reference table

---

## Validation Result

| Check | Status |
|---|---|
| Code Quality | Pass / Fail |
| Pattern Compliance | Pass / Fail |
| Interface Compliance | Pass / Fail |
| Tests | Pass / Fail |
| Build & Lint | Pass / Fail |
| Documentation | Pass / Fail |

**Overall**: Ready to merge / Needs fixes
