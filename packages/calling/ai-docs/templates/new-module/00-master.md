# New Module Workflow - Master Orchestrator

## Purpose

This template guides the creation of a new module within the `@webex/calling` package. It ensures every new module follows established patterns for types, constants, module classes, integration, testing, and validation.

---

## Entry Paths

### Direct Request

The user explicitly asks to create a new module (e.g., "create a Presence module", "add a new Recordings service").

### Feature Triage

Routed here from the root `AGENTS.md` or `ai-docs/README.md` when the task requires a new class, directory, or module that does not yet exist in the codebase.

---

## Prerequisites

Before starting, confirm the following:

- [ ] You have read `ai-docs/RULES.md` for coding standards
- [ ] You have read `ai-docs/patterns/typescript-patterns.md` for type and interface conventions
- [ ] You have read `ai-docs/patterns/event-driven-patterns.md` if the module emits events
- [ ] You have read `ai-docs/patterns/error-handling-patterns.md` for error class usage, error mapping, and error event emission conventions
- [ ] You have read `ai-docs/patterns/testing-patterns.md` for Jest conventions
- [ ] You understand the existing module structure by examining at least one reference implementation

---

## Workflow Overview

The workflow consists of 5 sequential steps. Each step has a completion gate that must be satisfied before proceeding.

```
Step 1          Step 2             Step 3           Step 4            Step 5
Pre-Questions   Code Generation    Integration      Tests             Validation
01-pre-         02-code-           03-integration   04-test-          05-validation
questions.md    generation.md      .md              generation.md     .md
     |               |                  |                |                |
     v               v                  v                v                v
  Gather spec    Generate files     Wire into        Write tests      Final checks
  from user      (types, consts,    package          (unit, event,    (build, lint,
                  service class)    exports          backend)         patterns)
```

### Step 1: Pre-Questions (`01-pre-questions.md`)

**STOP and ask the user questions first.** Gather the module specification including name, placement, API contract, event contract, dependencies, and exposure model. Do NOT generate any code until this step is complete.

### Step 2: Code Generation (`02-code-generation.md`)

Generate the module files: `types.ts`, `constants.ts`, and the main service class. Follow the appropriate file structure based on placement type (top-level, sub-module, or multi-backend).

### Step 3: Integration (`03-integration.md`)

Wire the new module into the package: update `src/api.ts` exports, add event keys to `Events/types.ts`, register Mercury listeners via `SDKConnector`, and add metric events if applicable.

### Step 4: Test Generation (`04-test-generation.md`)

Write co-located Jest tests covering initialization, method success/error paths, event emission, and backend connector delegation (if multi-backend).

### Step 5: Validation (`05-validation.md`)

Run through the final quality checklist: verify pattern compliance, build success, test passage, and documentation updates.

---

## Reference Implementations

Use these existing modules as reference when generating code:

| Module            | Complexity    | Key Patterns                                                                           | Path                 |
| ----------------- | ------------- | -------------------------------------------------------------------------------------- | -------------------- |
| **CallingClient** | Complex       | Sub-modules (Line, Call, Registration), state machines, media                          | `src/CallingClient/` |
| **CallHistory**   | Simple        | Single class, Eventing, Mercury listeners, SDKConnector                                | `src/CallHistory/`   |
| **CallSettings**  | Medium        | Multi-backend connectors (WXC/UCM), factory function                                   | `src/CallSettings/`  |
| **Contacts**      | Simple        | Single class, SDKConnector, SCIM/People API                                            | `src/Contacts/`      |
| **Voicemail**     | Multi-backend | WxCallBackendConnector, BroadworksBackendConnector, UcmBackendConnector, MetricManager | `src/Voicemail/`     |

### When to use which reference

- **Simple data-fetch module** (no backends, no events) --> Use Contacts as reference
- **Simple module with events** --> Use CallHistory as reference
- **Multi-backend module** --> Use Voicemail as reference
- **Sub-module of CallingClient** --> Examine `src/CallingClient/calling/` or `src/CallingClient/line/`

---

## Pattern References

These documents define the conventions your generated code must follow:

| Document            | Path                                        | Key Content                                        |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| Coding Standards    | `ai-docs/RULES.md`                          | Naming, imports, error handling, logging           |
| TypeScript Patterns | `ai-docs/patterns/typescript-patterns.md`   | Type definitions, interfaces, generics             |
| Event Patterns      | `ai-docs/patterns/event-driven-patterns.md` | Eventing base class, event keys, Mercury listeners |
| Error Handling Patterns | `ai-docs/patterns/error-handling-patterns.md` | Error classes, mapping utilities, and error emission conventions |
| Testing Patterns    | `ai-docs/patterns/testing-patterns.md`      | Jest conventions, mocking, fixture files           |

---

## Quick Checklist

Use this as a final summary before declaring the module complete:

- [ ] **Pre-questions answered** -- Module name, placement, API contract, events, dependencies, exposure
- [ ] **Types defined** -- Interface (`IModuleName`), response types, event types (if applicable)
- [ ] **Constants defined** -- File name constant, METHODS object, module-specific constants
- [ ] **Service class created** -- Extends `Eventing<T>`, uses SDKConnector, Logger, MetricManager
- [ ] **Factory function exported** -- `createModuleNameClient(webex, logger)` pattern
- [ ] **Integrated into package** -- Exports added to `src/api.ts`, event keys registered
- [ ] **Tests written** -- Co-located `.test.ts` file with fixtures, covers success/error/events
- [ ] **Validation passed** -- Build succeeds, tests pass, lint clean, patterns followed

---

**Next Step:** [01-pre-questions.md](./01-pre-questions.md) -- Gather the module specification before writing any code.
