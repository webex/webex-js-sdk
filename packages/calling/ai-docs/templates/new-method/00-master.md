# New Method Workflow — Orchestrator

> **Purpose**: Structured workflow for adding a new method to an existing module in the `@webex/calling` package.

---

## Use Cases

Use this workflow when:
- **Adding a new method** to an existing class (e.g., `doHoldResume` on `Call`, `getDeviceList` on `CallingClient`)
- **Extending module capabilities** with a new public or private operation
- **Adding a supplementary service** (hold, resume, transfer etc.)

Do NOT use this workflow for:
- **Creating an entirely new module** (new class/folder) -- Use [`../new-module/00-master.md`](../new-module/00-master.md) instead.
- **Enhancing or modifying an existing method** -- Use [`../existing-module/feature-enhancement.md`](../existing-module/feature-enhancement.md) instead.
- **Fixing a bug** -- Use [`../existing-module/bug-fix.md`](../existing-module/bug-fix.md) instead.

---

## Workflow Steps

### Step 1: Requirements Gathering
**Template**: [`01-requirements.md`](01-requirements.md)

STOP and ask the developer questions before writing any code. Collect:
- Method identity (target file, name, behavior)
- Method signature (parameters, return type)
- API integration details (if calling Mobius)
- Event contract (if emitting events)
- Metrics requirements
- Behavior details (success, failure, edge cases)

### Step 2: Implementation
**Template**: [`02-implementation.md`](02-implementation.md)

Write the method following the calling SDK's established patterns:
- Logger with `{ file, method }` context
- MetricManager via `getMetricManager()` for success/failure and state/progress metrics where applicable
- Error hierarchy (`ExtendedError` -> `CallError` / `LineError` / `CallingClientError`)
- `Eventing<T>` base class for typed event emission (only if the class emits/subscribes to SDK events)
- xstate state machine integration (if applicable)
- Constants, types, and event keys in canonical locations

### Step 3: Tests
**Template**: [`03-tests.md`](03-tests.md)

Write co-located unit tests (`*.test.ts` next to source):
- Success path tests
- Error/failure path tests
- Input validation tests
- Metric submission verification
- Event emission verification

### Step 4: Validation
**Template**: [`04-validation.md`](04-validation.md)

Run the quality checklist to verify:
- Pattern compliance (logging, metrics, errors, events)
- Constants and types added correctly
- Tests pass and cover all paths
- Build succeeds

---

## Reference Materials

| Resource | Path |
|---|---|
| Coding Standards | [`../../RULES.md`](../../RULES.md) |
| TypeScript Patterns | [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md) |
| Testing Patterns | [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md) |
| Event Patterns | [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md) |
| Error Handling Patterns | [`../../patterns/error-handling-patterns.md`](../../patterns/error-handling-patterns.md) |
| METHODS constant | `src/CallingClient/constants.ts` (`METHODS` object) |
| Metric events | `src/Metrics/types.ts` (`METRIC_EVENT` enum) |
| Event keys | `src/Events/types.ts` (`CALL_EVENT_KEYS`, `LINE_EVENT_KEYS`, etc.) |
| Error types | `src/Errors/types.ts` (`ERROR_TYPE`, `ERROR_LAYER`, `ERROR_CODE`) |
| Error classes | `src/Errors/catalog/` (`CallError`, `LineError`, `CallingClientError`) |
| Logger module | `src/Logger/index.ts` (default export with `log`, `error`, `info`, `warn`, `trace`) |

---

## Quick Checklist

Before marking the method as complete, verify every item:

- [ ] Method signature matches spec (parameters, return type, JSDoc)
- [ ] Logger called with `{ file: FILE_CONSTANT, method: METHODS.METHOD_NAME }` context
- [ ] MetricManager submits success metric on happy path
- [ ] MetricManager submits failure metric on error path
- [ ] Error hierarchy used (`createCallError` / `createLineError` / `CallingClientError`)
- [ ] JSDoc comment on the method with `@param` and `@returns` tags
- [ ] Types added to the module's `types.ts` (parameters, return types, interfaces)
- [ ] Method name added to `METHODS` object in `src/CallingClient/constants.ts`
- [ ] Event constants added to `src/Events/types.ts` (if emitting events)
- [ ] Metric event added to `METRIC_EVENT` in `src/Metrics/types.ts` (if new metric)
- [ ] Unit tests co-located (`*.test.ts` next to source)
- [ ] `yarn build` succeeds
- [ ] `yarn test:unit` passes
- [ ] `yarn test:style` passes
