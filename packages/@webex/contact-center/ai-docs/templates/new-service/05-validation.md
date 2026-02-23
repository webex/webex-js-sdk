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
# Lint
yarn workspace @webex/contact-center test:styles

# Test unit tests
yarn workspace @webex/contact-center test:unit

# Build
yarn workspace @webex/contact-center build:src
```

All should pass without errors.

---

## Documentation

### Update Root AGENTS.md?
If this is a significant new service, update the root [`AGENTS.md`](../../../AGENTS.md):
- [ ] Added new service to the [Service Routing Table](../../../AGENTS.md#service-routing-table)
- [ ] Added to repository structure tree
- [ ] Added usage example if applicable

### Create Service ai-docs?
For complex services, create service-level documentation (use [`create-agents-md.md`](../documentation/create-agents-md.md) and [`create-architecture-md.md`](../documentation/create-architecture-md.md) templates):
- [ ] `src/services/ServiceName/ai-docs/AGENTS.md` — usage guide, API reference
- [ ] `src/services/ServiceName/ai-docs/ARCHITECTURE.md` — technical deep-dive, data flow

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
