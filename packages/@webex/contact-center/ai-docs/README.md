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
| [AGENTS.md](AGENTS.md) | **Start here** - Main AI agent orchestrator |
| [RULES.md](RULES.md) | Coding standards and conventions |
| [patterns/](patterns/) | Pattern documentation |
| [templates/](templates/) | Code generation templates |

---

## For AI Agents

### Starting a Task

1. **Read [AGENTS.md](AGENTS.md)** - Identify your task type
2. **Route to template** - Follow the template for your task
3. **Load patterns** - Read relevant pattern documentation
4. **Generate/fix code** - Follow the established patterns
5. **Validate** - Use the checklist in AGENTS.md

### Key Rules (Always Follow)

1. **Always use LoggerProxy** - Never `console.log`
2. **Always track metrics** - `timeEvent` + `trackEvent`
3. **Always handle errors** - Use `getErrorDetails` pattern
4. **Always use event constants** - Never raw strings
5. **Always add JSDoc** - With `@public` for APIs

---

## Directory Structure

```
ai-docs/
├── AGENTS.md              # Main orchestrator (start here)
├── RULES.md               # Coding standards
├── README.md              # This file
├── patterns/              # Pattern documentation
│   ├── typescript-patterns.md
│   ├── testing-patterns.md
│   ├── event-driven-patterns.md
│   ├── websocket-patterns.md
│   └── sdk-plugin-patterns.md
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
yarn workspace @webex/contact-center build

# Test
yarn workspace @webex/contact-center test

# Lint
yarn workspace @webex/contact-center lint

# Type check
yarn workspace @webex/contact-center typecheck
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

## Service-Level AI Docs

Each service folder contains its own `ai-docs/` with:
- `AGENTS.md` - Usage examples, API reference, quick start
- `ARCHITECTURE.md` - Technical details, sequence diagrams, data flow

| Service | AGENTS.md | ARCHITECTURE.md |
|---------|-----------|-----------------|
| Agent | [`src/services/agent/ai-docs/AGENTS.md`](../src/services/agent/ai-docs/AGENTS.md) | [`src/services/agent/ai-docs/ARCHITECTURE.md`](../src/services/agent/ai-docs/ARCHITECTURE.md) |
| Task | [`src/services/task/ai-docs/AGENTS.md`](../src/services/task/ai-docs/AGENTS.md) | [`src/services/task/ai-docs/ARCHITECTURE.md`](../src/services/task/ai-docs/ARCHITECTURE.md) |
| Config | [`src/services/config/ai-docs/AGENTS.md`](../src/services/config/ai-docs/AGENTS.md) | [`src/services/config/ai-docs/ARCHITECTURE.md`](../src/services/config/ai-docs/ARCHITECTURE.md) |
| Core | [`src/services/core/ai-docs/AGENTS.md`](../src/services/core/ai-docs/AGENTS.md) | [`src/services/core/ai-docs/ARCHITECTURE.md`](../src/services/core/ai-docs/ARCHITECTURE.md) |

---

## Contributing to AI Docs

When adding new features:
1. Update the relevant service's docs (use the table above to find the right file):
   - Service `AGENTS.md` — if usage/API surface changed
   - Service `ARCHITECTURE.md` — if data flow or architecture changed
2. Add new patterns to [`patterns/`](patterns/) if introducing new patterns
3. Update [`templates/`](templates/) if the workflow changes
4. Update the root [`AGENTS.md`](../AGENTS.md) if task routing or critical rules changed
