# Getting Started — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prerequisites
- Node.js 22.14 for workspace development; the published package engine floor remains Node >=20.x. Use Yarn 3.4.1 from the workspace.
- Access to the workspace's npm registries and Webex backend environments is required for integration use.

The `@webex/contact-center` package is a Webex SDK plugin that provides a TypeScript/JavaScript API for building Contact Center agent applications. It enables:

- **Agent Session Management**: Register, login, logout, state changes

- **Task Handling**: Inbound/outbound calls, chat, transfers, conferences

- **Real-time Events**: WebSocket-based notifications for agent and task events

- **Browser-based Calling**: WebRTC integration for browser softphone

- **Metrics & Diagnostics**: Built-in telemetry and log upload

| Technology | Purpose |
|---|---|
| **TypeScript** | Primary language with strict mode |

| Technology | Purpose |
|---|---|
| **WebexPlugin** | Base class from `@webex/webex-core` |

| Technology | Purpose |
|---|---|
| **EventEmitter** | Event handling for real-time updates |

| Technology | Purpose |
|---|---|
| **WebSocket** | Real-time communication with Contact Center |

| Technology | Purpose |
|---|---|
| **WebRTC** | Browser-based calling (via WebCalling) |

| Technology | Purpose |
|---|---|
| **Jest** | Unit testing framework |

## Clone & Install
```bash
git clone https://github.com/webex/webex-js-sdk.git
cd webex-js-sdk
yarn install
```

## Build / Run / Test
| Task | Command |
|---|---|
| Build | `yarn workspace @webex/contact-center build:src` |
| Run locally | Consume through a Webex SDK host/application; this package has no standalone server. |
| Test | `yarn workspace @webex/contact-center test:unit` |
| Lint / format | `yarn workspace @webex/contact-center test:style` |

```bash
yarn workspace @webex/contact-center build:src

yarn workspace @webex/contact-center test:unit

yarn workspace @webex/contact-center test:unit -- test/unit/spec/cc.ts

yarn workspace @webex/contact-center test:style
```

## First-Run Verification
- Run the unit suite and confirm Jest enforces the package's 85% global thresholds from `jest.config.js`.

> AI-focused documentation for the `@webex/contact-center` package to enable LLM agents to effectively create, modify, and fix SDK code.

Each service folder contains its own `ai-docs/` with:

- `AGENTS.md` - Usage examples, API reference, quick start

- `ARCHITECTURE.md` - Technical details, sequence diagrams, data flow

| Service | AGENTS.md | ARCHITECTURE.md |
|---|---|---|
| Agent | [`src/services/agent/ai-docs/agent-spec.md`](../src/services/agent/ai-docs/agent-spec.md) | [`src/services/agent/ai-docs/agent-spec.md`](../src/services/agent/ai-docs/agent-spec.md) |

| Service | AGENTS.md | ARCHITECTURE.md |
|---|---|---|
| Task | [`src/services/task/ai-docs/task-spec.md`](../src/services/task/ai-docs/task-spec.md) | [`src/services/task/ai-docs/task-spec.md`](../src/services/task/ai-docs/task-spec.md) |

| Service | AGENTS.md | ARCHITECTURE.md |
|---|---|---|
| Config | [`src/services/config/ai-docs/config-spec.md`](../src/services/config/ai-docs/config-spec.md) | [`src/services/config/ai-docs/config-spec.md`](../src/services/config/ai-docs/config-spec.md) |

| Service | AGENTS.md | ARCHITECTURE.md |
|---|---|---|
| Core | [`src/services/core/ai-docs/core-spec.md`](../src/services/core/ai-docs/core-spec.md) | [`src/services/core/ai-docs/core-spec.md`](../src/services/core/ai-docs/core-spec.md) |

## Configuration & Secrets
- Runtime credentials and service routing come from the host Webex SDK and its environment configuration. Never hardcode or log tokens.

## Dev Environment
- The package builds inside the Yarn workspace and consumes sibling `@webex/*` packages through workspace dependencies.

```text
packages/@webex/contact-center/
├── AGENTS.md                  # Main orchestrator (start here — at package root)
└── ai-docs/
    ├── README.md              # This file
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

```text
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

## Where to Go Next
- Agent entry: `../AGENTS.md` · System shape: `ARCHITECTURE.md` · Routing: `SPEC_INDEX.md`
- Conventions: `patterns/`, `RULES.md`, and the manifest-routed module specification for the target capability.

| Document | Purpose |
|---|---|
| [AGENTS.md](../AGENTS.md) | **Start here** - Main AI agent orchestrator (at package root) |

| Document | Purpose |
|---|---|
| [RULES.md](RULES.md) | Coding standards and conventions |

| Document | Purpose |
|---|---|
| [patterns/](patterns/) | Pattern documentation |

| Document | Purpose |
|---|---|
| [templates/](templates/) | Code generation templates |

Start with the root [`AGENTS.md`](../AGENTS.md) for critical repository rules and the developer workflow, then use [`SPEC_INDEX.md`](SPEC_INDEX.md) to classify the task by owning module and open its canonical `*-spec.md`.

When adding new features:

1. Update the relevant service's docs (use the table above to find the right file):

- Service `AGENTS.md` — if usage/API surface changed

- Service `ARCHITECTURE.md` — if data flow or architecture changed

2. Add new patterns to [`patterns/`](patterns/) if introducing new patterns

3. Update [`templates/`](templates/) if the workflow changes

4. Update the root [`AGENTS.md`](../AGENTS.md) if task routing or critical rules changed
