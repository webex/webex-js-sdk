# Contact Center SDK - AI Documentation

> AI-focused documentation for the `@webex/contact-center` package to enable LLM agents to effectively create, modify, and fix SDK code.

---

## Package Overview

The `@webex/contact-center` package is a Webex SDK plugin that provides a TypeScript/JavaScript API for building Contact Center agent applications. It enables:

- **Agent Session Management**: Register, login, logout, state changes
- **Task Handling**: Inbound/outbound calls, chat, transfers, conferences
- **Real-time Events**: WebSocket-based notifications for agent and task events
- **Browser-based Calling**: WebRTC integration for browser softphone
- **Metrics & Diagnostics**: Built-in telemetry and log upload

---

## Technologies

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Primary language with strict mode |
| **WebexPlugin** | Base class from `@webex/webex-core` |
| **EventEmitter** | Event handling for real-time updates |
| **WebSocket** | Real-time communication with Contact Center |
| **WebRTC** | Browser-based calling (via WebCalling) |
| **Jest** | Unit testing framework |

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | **Start here** - Main AI agent orchestrator (at package root) |
| [SPEC_INDEX.md](SPEC_INDEX.md) | Route work to the owning canonical module specification |
| [RULES.md](RULES.md) | Coding standards and conventions |
| [patterns/](patterns/) | Pattern documentation |
| [templates/](templates/) | Code generation templates |

---

## For AI Agents

### Starting a Task

Start with the root [`AGENTS.md`](../AGENTS.md) for critical repository rules and the developer workflow, then use [`SPEC_INDEX.md`](SPEC_INDEX.md) to classify the task by owning module and open its canonical `*-spec.md`.

---

## Directory Structure

```
packages/@webex/contact-center/
├── AGENTS.md                  # Main orchestrator (start here — at package root)
└── ai-docs/
    ├── README.md              # This file
    ├── SPEC_INDEX.md          # Canonical module router
    ├── contact-center-spec.md # Canonical public plugin specification
    ├── CONTRACTS.md           # Public contract catalog
    ├── adr/                   # Durable architecture decisions
    ├── RULES.md               # Coding standards
    ├── patterns/              # Pattern documentation
    │   ├── typescript-patterns.md
    │   ├── testing-patterns.md
    │   └── event-driven-patterns.md
    └── templates/             # Code generation templates
        ├── README.md
        ├── new-service/       # Creating new services
        ├── new-method/        # Adding methods
        ├── existing-service/  # Bug fixes, features
        └── documentation/     # Doc generation
```

---

## Package Commands

```bash
# Build
yarn workspace @webex/contact-center build:src

# Test unit tests
yarn workspace @webex/contact-center test:unit

# Test specific file
yarn workspace @webex/contact-center test:unit -- <path_of_test_file>

# Lint
yarn workspace @webex/contact-center test:style
```

---

## Service Architecture

```
ContactCenter (cc.ts)
└── Services (singleton)
    ├── agent/      → Agent operations (login, logout, state)
    ├── task/       → Task operations (hold, transfer, wrapup)
    │   └── TaskManager → Task lifecycle
    ├── config/     → Configuration fetching
    ├── core/       → WebSocket, HTTP, utilities
    ├── AddressBook → Address book entries
    ├── EntryPoint  → Entry points
    └── Queue       → Queues
```

---

## Canonical Module Specifications

Use [`SPEC_INDEX.md`](SPEC_INDEX.md) to select the owning module. Each manifest-routed module has one canonical `*-spec.md`; retained module-level `AGENTS.md` and `ARCHITECTURE.md` files are legacy/reference-only migration sources, as recorded in [`ADR-0001`](adr/0001-spec-source-policy.md).

| Module | Canonical specification |
|---|---|
| Contact Center public plugin | [`contact-center-spec.md`](contact-center-spec.md) |
| Metrics | [`metrics-spec.md`](../src/metrics/ai-docs/metrics-spec.md) |
| Services composition | [`services-spec.md`](../src/services/ai-docs/services-spec.md) |
| Agent | [`agent-spec.md`](../src/services/agent/ai-docs/agent-spec.md) |
| Config | [`config-spec.md`](../src/services/config/ai-docs/config-spec.md) |
| Core | [`core-spec.md`](../src/services/core/ai-docs/core-spec.md) |
| Task | [`task-spec.md`](../src/services/task/ai-docs/task-spec.md) |
| Task state machine | [`task-state-machine-spec.md`](../src/services/task/state-machine/ai-docs/task-state-machine-spec.md) |
| Utils | [`utils-spec.md`](../src/utils/ai-docs/utils-spec.md) |

---

## Contributing to AI Docs

When adding new features:
1. Use [`SPEC_INDEX.md`](SPEC_INDEX.md) to select the owning canonical module specification.
2. Update that `*-spec.md` with the behavior, source evidence, test evidence, and known gaps.
3. For exported API, event, or type changes, also update [`CONTRACTS.md`](CONTRACTS.md), the Contact Center specification, and `.sdd/manifest.json` when its routing, coverage, or validation evidence changes.
4. Add or update [`patterns/`](patterns/) and [`templates/`](templates/) only when their reusable guidance changes.
5. Update the root [`AGENTS.md`](../AGENTS.md) when task routing or critical rules change. Do not update retained service `AGENTS.md` or `ARCHITECTURE.md` as an independent source of truth.
