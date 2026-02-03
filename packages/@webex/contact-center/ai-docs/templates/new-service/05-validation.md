# New Service - Validation Checklist

> **Purpose**: Final quality check before completing service creation.

---

## Code Quality Checklist

### Service Class
- [ ] File created at `src/services/ServiceName.ts`
- [ ] Class has proper JSDoc with `@public` tag
- [ ] Methods have JSDoc with `@param`, `@returns`, `@example`
- [ ] Uses `LoggerProxy` for all logging (no `console.log`)
- [ ] Error handling logs and re-throws errors
- [ ] Module name constant defined (`SERVICE_FILE`)
- [ ] Method name constants defined (`METHODS`)

### Types
- [ ] All public types have JSDoc
- [ ] Response types match actual API response
- [ ] Parameter types define all optional/required fields
- [ ] Types exported from service file

### Integration
- [ ] Service imported in `cc.ts`
- [ ] Property added to ContactCenter class
- [ ] Initialized in `$webex.once(READY, ...)` block
- [ ] Types re-exported from `src/types.ts` (if public)

### Tests
- [ ] Test file created in `test/unit/spec/services/`
- [ ] LoggerProxy mocked
- [ ] Success cases tested
- [ ] Error cases tested
- [ ] Pagination/filtering tested (if applicable)
- [ ] Tests pass: `yarn workspace @webex/contact-center test`

---

## Pattern Compliance

### LoggerProxy Usage
```typescript
// ✅ Correct
LoggerProxy.info('Starting operation', {
  module: SERVICE_FILE,
  method: METHODS.GET_ITEMS,
});

// ❌ Wrong
console.log('Starting operation');
```

### Error Handling
```typescript
// ✅ Correct
catch (error) {
  LoggerProxy.error(`Failed: ${error}`, {
    module: SERVICE_FILE,
    method: METHODS.GET_ITEMS,
    error,
  });
  throw error;
}

// ❌ Wrong - swallowing error
catch (error) {
  console.error(error);
}
```

### Type Exports
```typescript
// ✅ Correct - in src/types.ts
export type {
  ServiceItem,
  ServiceSearchParams,
  ServiceListResponse,
} from './services/ServiceName';
```

---

## Build & Test Verification

```bash
# Type check
yarn workspace @webex/contact-center typecheck

# Lint
yarn workspace @webex/contact-center lint

# Build
yarn workspace @webex/contact-center build

# Test
yarn workspace @webex/contact-center test
```

All should pass without errors.

---

## Documentation

### Update AGENTS.md?
If this is a significant new service:
- [ ] Added to repository structure in `ai-docs/AGENTS.md`
- [ ] Added usage example if applicable

### Create Service ai-docs?
For complex services, consider creating:
- [ ] `src/services/ServiceName/ai-docs/AGENTS.md`
- [ ] `src/services/ServiceName/ai-docs/ARCHITECTURE.md`

---

## Final Review

Ask yourself:
1. Can another developer understand this service by reading the JSDoc?
2. Are all error paths properly handled and logged?
3. Do tests cover the main use cases?
4. Is the API surface clean and consistent with other services?

---

## Complete!

Service creation is complete when all checkboxes are checked.
