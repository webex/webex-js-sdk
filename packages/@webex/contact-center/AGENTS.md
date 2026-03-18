# Contact Center SDK - AI Agent Guide

## Purpose

This is the main orchestrator for AI assistants working with the package `@webex/contact-center` in this repository. It routes you to the correct templates and documentation based on the developer's task and provides critical rules for code generation.

**For every developer request, follow the Quick Start Workflow below.**

---

## Quick Start Workflow

When a developer provides a task, follow this workflow **in order**:

1. **Classify the task** - Use the Task Classification Decision Tree below to identify the task type (A-F). If you cannot confidently classify, ask the developer.
2. **STOP — Ask the developer questions** - Open the routed template's pre-questions file. Present every MANDATORY question to the developer. Wait for their answers. **Do NOT proceed until all MANDATORY fields have explicit answers from the developer.** Do not infer, assume, or fill in answers yourself.
3. **Present Spec Summary for approval** - After gathering answers, present a structured summary of what you will build (see Spec Summary Gate below). Wait for the developer to confirm.
4. **Load context** - Use the [Service Routing Table](#service-routing-table) to find and read the target service's `AGENTS.md` and `ARCHITECTURE.md`, then load relevant patterns.
5. **Break down large or multi-part tasks** - If the prompt mixes multiple tasks (for example, "add a method" and "fix a bug"), split into smaller scoped subtasks and execute them one by one — each subtask goes through steps 1-3 independently.
6. **Generate/fix code** - Follow established package patterns and the routed template's implementation steps.
7. **Validate functionality and quality** - Verify behavior, tests, lint, and type checks.
8. **Update documentation** - Keep ai-docs aligned with code changes.
9. **Ask for review** - Confirm completion and offer adjustments.

---

## Task Classification Decision Tree

Use these questions **in order** to classify the developer's request. Follow the first matching path.

```
Q1: Is the task read-only (understanding, explaining, or analyzing code)?
├── YES → Type E: Understand Architecture
│
└── NO → Q2: Is something broken or behaving incorrectly?
    ├── YES → Is this a UI/UX improvement or a code-level defect?
    │   ├── UI/UX fix (visual, layout, interaction) → Type D: Add Feature / Enhance Existing Service
    │   └── Code-level defect (wrong behavior, crash, data issue) → Type C: Fix Bug
    │
    └── NO → Q3: Does this involve creating a new file, class, or module?
        ├── YES → Type A: Create New Service
        │
        └── NO → Q4: Does this involve adding a brand-new method that does not exist yet?
            │   NOTE: If the developer describes a "capability" or "feature" that
            │   happens to require a new method, check signal keywords — if the
            │   request matches Type D signals ("add capability", "enhance", "enable"),
            │   use the Disambiguation Rule to confirm with the developer.
            ├── YES → Type B: Add New Method
            │
            └── NO → Q5: Does this involve changing an existing method's signature, behavior, parameters, or return type?
                ├── YES → Type F: Modify Existing Method
                │
                └── NO → Type D: Add Feature / Enhance Existing Service
```

### Signal Keywords by Task Type

Use these keyword patterns to help confirm your classification:

| Task Type | Signal Keywords in Developer Request |
|---|---|
| **A. Create New Service** | "new service", "new module", "new class", "create a service for", "add a new [ServiceName]", "like AddressBook/Queue/EntryPoint" |
| **B. Add New Method** | "add a method", "add an API", "new method", "expose a new function", "add [methodName] to" |
| **C. Fix Bug** | "bug", "broken", "not working", "regression", "incorrect", "error", "crash", "unexpected behavior", "fix" |
| **D. Add Feature** | "enhance", "add feature", "add capability", "improve", "extend", "support for", "enable" |
| **E. Understand Architecture** | "explain", "how does", "understand", "architecture", "what is", "walk me through", "show me" |
| **F. Modify Existing Method** | "change", "modify", "update", "add parameter to", "change return type", "rename", "refactor [methodName]" |

### Disambiguation Rule

**If you cannot confidently classify the task after using the decision tree and signal keywords, ask the developer:**

> "I want to make sure I follow the right workflow. Which of these best describes your task?"
> - A. Create a new service/module (new file/class)
> - B. Add a new method to an existing service
> - C. Fix a bug or incorrect behavior
> - D. Add a feature or enhance an existing service
> - E. Understand/explain the architecture (no code changes)
> - F. Modify an existing method (change signature, behavior, parameters)

**Do not guess. Do not default to the most common type. Ask.**

---

## Task Type Routing

**A. Create New Service**
- Use when adding a new service module (for example, a new service to support real-time transcripts, similar to existing services like AddressBook, Queue, or EntryPoint).
- **Route to:** [`ai-docs/templates/new-service/00-master.md`](ai-docs/templates/new-service/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-service/01-pre-questions.md`](ai-docs/templates/new-service/01-pre-questions.md) — STOP and ask these first.
- **Follow:** Full new-service workflow including validation and docs updates.

**B. Add New Method**
- Use when extending an existing service with a new method/API.
- **Route to:** [`ai-docs/templates/new-method/00-master.md`](ai-docs/templates/new-method/00-master.md)
- **Pre-questions:** [`ai-docs/templates/new-method/01-requirements.md`](ai-docs/templates/new-method/01-requirements.md) — STOP and ask these first.
- **Follow:** Method signature, implementation, tests, and validation checklist.

**C. Fix Bug**
- Use when behavior is incorrect or regressions are reported.
- **Route to:** [`ai-docs/templates/existing-service/bug-fix.md`](ai-docs/templates/existing-service/bug-fix.md)
- **Pre-questions:** Bug-fix template Section A (Questions for the Developer) — STOP and ask these first.
- **Follow:** Gather info from developer -> Investigate -> Root cause -> Fix -> Regression validation.

**D. Add Feature**
- Use when enhancing capabilities, then decide placement via triage:
  - existing service/module enhancement, or
  - new standalone service/module creation.
- **Route to:** [`ai-docs/templates/existing-service/feature-enhancement.md`](ai-docs/templates/existing-service/feature-enhancement.md)
- **Pre-questions:** Feature-enhancement template Step 0 (Placement Triage) + Pre-Enhancement Questions — STOP and ask these first.
- **Follow:** Run mandatory feature placement triage. If triage indicates a new service/module, reroute to [`ai-docs/templates/new-service/00-master.md`](ai-docs/templates/new-service/00-master.md).

**E. Understand Architecture**
- Use when the task is analysis/explanation and no immediate code generation is required.
- **Route to:** Use the [Service Routing Table](#service-routing-table) to identify the relevant service, then load its `AGENTS.md` and `ARCHITECTURE.md`:
  - Agent: [`src/services/agent/ai-docs/`](src/services/agent/ai-docs/AGENTS.md)
  - Task: [`src/services/task/ai-docs/`](src/services/task/ai-docs/AGENTS.md)
  - Config: [`src/services/config/ai-docs/`](src/services/config/ai-docs/AGENTS.md)
  - Core: [`src/services/core/ai-docs/`](src/services/core/ai-docs/AGENTS.md)
- **Follow:** Read-only architecture exploration with clear explanation.
- No pre-questions required (read-only task).

**F. Modify Existing Method**
- Use when changing an existing method's signature, behavior, parameters, or return type.
- **Route to:** [`ai-docs/templates/existing-service/feature-enhancement.md`](ai-docs/templates/existing-service/feature-enhancement.md) (follow the same workflow, but skip placement triage — the method already exists).
- **Pre-questions:** Feature-enhancement template Pre-Enhancement Questions (skip Step 0 triage) — STOP and ask these first.
- **Follow:** Gather requirements -> Design change -> Implement -> Test -> Validate backward compatibility.

If a developer request includes multiple task types, split into ordered subtasks and execute each through the full classify -> question -> spec-summary -> implement sequence.

---

## Spec Summary Gate (MANDATORY before code generation)

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
- HTTP: [METHOD] [endpoint]
- Request payload: [structure]
- Response payload: [structure]

### Events (if applicable):
| Event | Direction | Object | Payload | Trigger |
|---|---|---|---|---|
| [event name] | [emitted / listened] | [cc, task, taskManager, or service] | [payload type] | [what causes it] |
(or "No events")

### Metrics (if applicable):
- Success: [metric name]
- Failure: [metric name]

### Breaking changes: [Yes/No — if yes, describe migration]

### Files to create/modify:
1. [file path] — [what changes]
2. [file path] — [what changes]

---
Does this match your intent? (Yes / No / Adjust)
```

**Rules:**
- Do NOT begin implementation until the developer confirms.
- If the developer says "Adjust", gather the corrections and re-present the summary.
- If the developer says "Skip" or "Just do it", you may proceed without the summary — but this must be an explicit developer choice.

---

## CRITICAL RULES (Always Apply)

### 1. STOP and Ask Before Coding (MANDATORY — HIGHEST PRIORITY)

**This is the most important rule in this guide.**

Before writing, generating, or modifying any code:
1. Classify the task using the decision tree.
2. Present the template's pre-questions to the developer.
3. Wait for answers. Do not infer or assume.
4. Present the Spec Summary. Wait for approval.

**Violations of this rule include:**
- Reading code to "understand the context" before asking the developer questions
- Filling in pre-question answers yourself based on the developer's initial request
- Skipping the Spec Summary because the task "seems straightforward"
- Starting implementation while pre-questions have unanswered MANDATORY fields

The only exception is **Type E (Understand Architecture)** which is read-only.

---

### 2. LoggerProxy Usage (MANDATORY)

**NEVER use `console.log()`.** Always use `LoggerProxy` with `module` and `method` context. See full patterns and examples in [`ai-docs/RULES.md`](ai-docs/RULES.md) and [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md).

---

### 3. MetricsManager Usage (MANDATORY)

All operations must track metrics using `timeEvent` + `trackEvent`. See full pattern in [`ai-docs/RULES.md`](ai-docs/RULES.md).

---

### 4. Error Handling Pattern (MANDATORY)

Always use `getErrorDetails` from `services/core/Utils` for consistent error handling. See full pattern in [`ai-docs/RULES.md`](ai-docs/RULES.md) and [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md).

---

### 5. Event Emission Pattern (MANDATORY)

Use defined event constants (`CC_EVENTS`, `AGENT_EVENTS`, `TASK_EVENTS`), never raw strings. See full pattern in [`ai-docs/RULES.md`](ai-docs/RULES.md) and [`ai-docs/patterns/event-driven-patterns.md`](ai-docs/patterns/event-driven-patterns.md).

---

### 6. WebexPlugin Extension Pattern (MANDATORY)

Follow the established `cc.ts` plugin class pattern with JSDoc (`@public`, `@param`, `@returns`, `@example`). Refer to `src/cc.ts` directly for the canonical implementation.

---

### 7. Scope ai-docs Are Authoritative (MANDATORY)

When working inside a service scope, use the [Service Routing Table](#service-routing-table) to locate and load that service's `AGENTS.md` and `ARCHITECTURE.md`. Treat them as implementation authority for that scope.

- This root `AGENTS.md` is the orchestrator — it routes tasks and enforces rules.
- Service-level `ai-docs` define scope-specific behavior, architecture, and patterns.
- If there is any conflict between root and service docs, prefer the service docs for that scope.

---

### 8. Context Guardrail (APPLIES EVERYWHERE)

For **every** task type (new service, new method, bug fix, feature enhancement, architecture), gather context in this order:

1. Same package code under `@webex/contact-center`
2. Same package ai-docs (`AGENTS.md`, `ARCHITECTURE.md`, templates, patterns)
3. Same package tests

Only use references from other plugins/modules/packages when the developer explicitly requests it.

Mandatory behavior:
- Prefer local package implementations/patterns before external references.
- If required context is missing, ask targeted clarification questions instead of guessing.
- Document what local references were used before implementation.

---

## Context Loading by Task Type

**First:** Identify the affected service using the [Service Routing Table](#service-routing-table). Load that service's `AGENTS.md` and `ARCHITECTURE.md` via the direct links in the table.

### For New Service/Method:
1. Load the affected service's docs via [Service Routing Table](#service-routing-table)
2. Read [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md)
3. Read [`ai-docs/patterns/event-driven-patterns.md`](ai-docs/patterns/event-driven-patterns.md)
4. Read [`ai-docs/patterns/testing-patterns.md`](ai-docs/patterns/testing-patterns.md)
5. Read existing service in same category (e.g., `AddressBook.ts` for new data service)

### For Bug Fix:
1. Load the affected service's docs via [Service Routing Table](#service-routing-table) — prioritize `ARCHITECTURE.md`
2. Read [`ai-docs/patterns/testing-patterns.md`](ai-docs/patterns/testing-patterns.md)
3. Read related test files

### For Feature Enhancement / Modify Existing Method:
1. Load the affected service's docs via [Service Routing Table](#service-routing-table) — prioritize `AGENTS.md`
2. Read [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md)
3. Read related existing implementation

---

## Repository Structure

```
packages/@webex/contact-center/
├── src/
│   ├── cc.ts                          # Main plugin class (WebexPlugin)
│   ├── types.ts                       # Public types and interfaces
│   ├── constants.ts                   # Package constants
│   ├── logger-proxy.ts                # LoggerProxy implementation
│   ├── metrics/
│   │   ├── MetricsManager.ts          # Singleton metrics manager
│   │   ├── behavioral-events.ts       # Behavioral event taxonomy
│   │   └── constants.ts               # METRIC_EVENT_NAMES
│   └── services/
│       ├── index.ts                   # Services singleton
│       ├── AddressBook.ts             # Address book service
│       ├── EntryPoint.ts              # Entry point service
│       ├── Queue.ts                   # Queue service
│       ├── WebCallingService.ts       # WebRTC calling service
│       ├── agent/                     # Agent operations
│       │   ├── index.ts               # Agent service factory
│       │   ├── types.ts               # Agent types and events
│       │   └── ai-docs/               # Agent-specific AI documentation
│       │       ├── AGENTS.md           # Agent usage guide
│       │       └── ARCHITECTURE.md     # Agent technical deep-dive
│       ├── task/                      # Task management
│       │   ├── TaskManager.ts         # Task lifecycle manager
│       │   ├── contact.ts             # Contact operations
│       │   ├── dialer.ts              # Outbound dialing
│       │   ├── AutoWrapup.ts          # Auto wrapup handler
│       │   ├── types.ts               # Task types and events
│       │   └── ai-docs/               # Task-specific AI documentation
│       │       ├── AGENTS.md           # Task usage guide
│       │       └── ARCHITECTURE.md     # Task technical deep-dive
│       ├── config/                    # Configuration
│       │   ├── index.ts               # Config service
│       │   ├── types.ts               # CC_EVENTS, Profile, etc.
│       │   ├── constants.ts           # Config constants
│       │   └── ai-docs/               # Config-specific AI documentation
│       │       ├── AGENTS.md           # Config usage guide
│       │       └── ARCHITECTURE.md     # Config technical deep-dive
│       └── core/                      # Core utilities
│           ├── WebexRequest.ts        # HTTP request handler
│           ├── Utils.ts               # Utility functions
│           ├── Err.ts                 # Error classes
│           ├── GlobalTypes.ts         # Failure, AugmentedError
│           ├── aqm-reqs.ts            # AQM request handler
│           ├── websocket/
│           │   ├── WebSocketManager.ts # WebSocket handler
│           │   └── connection-service.ts
│           └── ai-docs/               # Core-specific AI documentation
│               ├── AGENTS.md           # Core usage guide
│               └── ARCHITECTURE.md     # Core technical deep-dive
├── test/
│   └── unit/
│       └── spec/
│           └── cc.ts                  # Main test file (reference)
└── ai-docs/                           # AI documentation
    ├── README.md                      # AI-docs overview
    ├── RULES.md                       # Coding standards
    ├── patterns/                      # Pattern documentation
    └── templates/                     # Code generation templates
```

---

## Key Type Patterns

For enum patterns (const object + type), response type patterns, and failure type patterns, see [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md).

---

## Validation Checklist (After Code Generation)

- [ ] **LoggerProxy**: All methods use LoggerProxy with `module` and `method` context
- [ ] **Metrics**: Operations track success/failure with `timeEvent` + `trackEvent`
- [ ] **Error Handling**: Uses `getErrorDetails` pattern
- [ ] **Types**: All public types have JSDoc with `@public` tag
- [ ] **Events**: Uses event constants (CC_EVENTS, AGENT_EVENTS, TASK_EVENTS)
- [ ] **Tests**: Added/updated unit tests with MockWebex
- [ ] **Exports**: New types exported from `types.ts`
- [ ] **No console.log**: Zero instances of console.log/warn/error

---

## Functionality Validation Gate (CRITICAL)

Before marking any coding task complete, verify:

1. **API/Type correctness**
   - method signatures and payload types align with existing contracts
   - no accidental breaking API changes
2. **Pattern compliance**
   - `LoggerProxy`, `MetricsManager`, `getErrorDetails`, event constants
3. **Behavior correctness**
   - success/failure paths covered
   - state/event flow is correct for affected service
4. **Quality checks**
   - relevant unit tests pass
   - lint/type checks pass

If any gate fails, fix before completion.

---

## Documentation Update Gate

After code changes, verify whether docs must be updated:

- Service-level docs (use [Service Routing Table](#service-routing-table) to locate):
  - Service `AGENTS.md` — if usage/workflow changed
  - Service `ARCHITECTURE.md` — if data flow/architecture changed
- Root-level docs:
  - This file ([`AGENTS.md`](AGENTS.md)) — if task routing or rules changed
  - [`ai-docs/templates/`](ai-docs/templates/) — if a new reusable template is needed
  - [`ai-docs/patterns/`](ai-docs/patterns/) — if a new reusable pattern is introduced

---

## Success Criteria

- Follows required coding patterns (`LoggerProxy`, metrics, error handling, event constants)
- Implements intended behavior without regressions
- Includes/updates tests where needed
- Passes lint/type/test checks
- Updates docs when behavior or architecture changes

---

## Service-Level Documentation

For deep understanding of specific services, read their `ai-docs/`. When working on a task that affects a specific service, **always load that service's AGENTS.md and ARCHITECTURE.md** for scope-specific guidance.

### Service Routing Table

Use this table to identify which service's ai-docs to load based on the developer's task:

| Service | Scope / Keywords | AGENTS.md | ARCHITECTURE.md |
|---------|-----------------|-----------|-----------------|
| **Agent** | login, logout, state change, buddy agents, station | [`src/services/agent/ai-docs/AGENTS.md`](src/services/agent/ai-docs/AGENTS.md) | [`src/services/agent/ai-docs/ARCHITECTURE.md`](src/services/agent/ai-docs/ARCHITECTURE.md) |
| **Task** | task, hold, transfer, conference, wrapup, outdial, consult | [`src/services/task/ai-docs/AGENTS.md`](src/services/task/ai-docs/AGENTS.md) | [`src/services/task/ai-docs/ARCHITECTURE.md`](src/services/task/ai-docs/ARCHITECTURE.md) |
| **Config** | profile, register, teams, aux codes, desktop profile, settings | [`src/services/config/ai-docs/AGENTS.md`](src/services/config/ai-docs/AGENTS.md) | [`src/services/config/ai-docs/ARCHITECTURE.md`](src/services/config/ai-docs/ARCHITECTURE.md) |
| **Core** | websocket, HTTP, connection, reconnect, aqm, utils, errors | [`src/services/core/ai-docs/AGENTS.md`](src/services/core/ai-docs/AGENTS.md) | [`src/services/core/ai-docs/ARCHITECTURE.md`](src/services/core/ai-docs/ARCHITECTURE.md) |

**Routing rule:** If the developer's task mentions keywords in the "Scope / Keywords" column, load that service's ai-docs. If multiple services are involved, load all relevant ones. If unsure which service is affected, ask the developer.

---

## Need More Context?

- **TypeScript patterns**: [`ai-docs/patterns/typescript-patterns.md`](ai-docs/patterns/typescript-patterns.md)
- **Testing patterns**: [`ai-docs/patterns/testing-patterns.md`](ai-docs/patterns/testing-patterns.md)
- **Event patterns**: [`ai-docs/patterns/event-driven-patterns.md`](ai-docs/patterns/event-driven-patterns.md)
