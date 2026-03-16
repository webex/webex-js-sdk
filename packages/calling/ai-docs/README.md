# @webex/calling - AI Documentation Hub

## Overview

This directory contains AI-optimized documentation for the `@webex/calling` package. It enables AI agents to understand, modify, and generate code that follows established patterns.

**Start here:** Read the root [`AGENTS.md`](../AGENTS.md) for task classification, routing, and critical rules.

---

## Package Purpose

`@webex/calling` provides browser-based telephony via the Webex Calling platform:

- Line registration with Mobius signaling backend
- WebRTC call management (dial, answer, hold, transfer, mute, DTMF)
- Call history retrieval and management
- Call settings (forwarding, voicemail configuration)
- Contacts resolution (SCIM, People API)
- Voicemail management (list, playback, delete, transcription)

---

## Quick Links

| Resource | Path | Purpose |
|---|---|---|
| Root AGENTS.md | [`../AGENTS.md`](../AGENTS.md) | Task classification, routing, critical rules |
| RULES.md | [`RULES.md`](RULES.md) | Coding standards and conventions |
| TypeScript Patterns | [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md) | Type, interface, and code patterns |
| Testing Patterns | [`patterns/testing-patterns.md`](patterns/testing-patterns.md) | Jest test conventions |
| Event Patterns | [`patterns/event-driven-patterns.md`](patterns/event-driven-patterns.md) | Event-driven architecture patterns |
| New Method Template | [`templates/new-method/00-master.md`](templates/new-method/00-master.md) | Add method to existing module |
| New Module Template | [`templates/new-module/00-master.md`](templates/new-module/00-master.md) | Create new module |
| Bug Fix Template | [`templates/existing-module/bug-fix.md`](templates/existing-module/bug-fix.md) | Fix bugs in existing code |
| Feature Enhancement Template | [`templates/existing-module/feature-enhancement.md`](templates/existing-module/feature-enhancement.md) | Enhance existing modules |

---

## Directory Structure

```
ai-docs/
├── README.md                          # This file - navigation hub
├── RULES.md                           # Coding standards
├── patterns/
│   ├── typescript-patterns.md         # TypeScript patterns
│   ├── testing-patterns.md            # Jest testing patterns
│   └── event-driven-patterns.md       # Event architecture patterns
└── templates/
    ├── new-method/                    # Adding methods to existing modules
    │   ├── 00-master.md               # Workflow orchestrator
    │   ├── 01-requirements.md         # Requirements questionnaire (STOP & ask)
    │   ├── 02-implementation.md       # Implementation guide
    │   ├── 03-tests.md               # Test template
    │   └── 04-validation.md          # Quality checklist
    ├── new-module/                    # Creating new modules
    │   ├── 00-master.md               # Workflow orchestrator
    │   ├── 01-pre-questions.md        # Pre-implementation questionnaire (STOP & ask)
    │   ├── 02-code-generation.md      # Code generation guide
    │   ├── 03-integration.md          # Integration guide
    │   ├── 04-test-generation.md      # Test generation guide
    │   └── 05-validation.md           # Quality checklist
    └── existing-module/               # Bug fixes & feature enhancements
        ├── bug-fix.md                 # Bug investigation & fix workflow
        └── feature-enhancement.md     # Feature enhancement workflow
```

---

## Template Selection Guide

| Task | Template | Pre-questions? |
|---|---|---|
| Create a new module (new class/folder) | [`templates/new-module/00-master.md`](templates/new-module/00-master.md) | Yes — 01-pre-questions.md |
| Add a new method to existing module | [`templates/new-method/00-master.md`](templates/new-method/00-master.md) | Yes — 01-requirements.md |
| Fix a bug in existing code | [`templates/existing-module/bug-fix.md`](templates/existing-module/bug-fix.md) | Yes — Section A |
| Add feature to existing module | [`templates/existing-module/feature-enhancement.md`](templates/existing-module/feature-enhancement.md) | Yes — Step 0 + Section A |
| Modify existing method | [`templates/existing-module/feature-enhancement.md`](templates/existing-module/feature-enhancement.md) | Yes — Section A (skip Step 0) |
| Understand/explain architecture | Use [Module Routing Table](../AGENTS.md#module-routing-table) | No (read-only) |

---

## Module Architecture

```
                    ┌──────────────────────────┐
                    │      CallingClient        │
                    │    (ICallingClient)        │
                    │  Entry point for calling   │
                    └─────────┬────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────┴──────┐ ┌─────┴──────┐ ┌──────┴────────┐
     │     Line      │ │ CallManager│ │ MetricManager  │
     │   (ILine)     │ │(ICallManager)│ │(IMetricManager)│
     └───────┬───────┘ └─────┬──────┘ └───────────────┘
             │               │
    ┌────────┴──────┐  ┌─────┴──────┐
    │ Registration  │  │    Call     │
    │(IRegistration)│  │  (ICall)   │
    └───────────────┘  └─────┬──────┘
                             │
                      ┌──────┴──────┐
                      │  CallerId   │
                      │(ICallerId)  │
                      └─────────────┘

  Other top-level modules (independent):
  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────┐
  │ CallHistory │ │ CallSettings│ │ Contacts │ │ Voicemail │
  └─────────────┘ └─────────────┘ └──────────┘ └───────────┘
```

---

## Module-Level AI Docs

| Module | AGENTS.md | ARCHITECTURE.md | Description |
|---|---|---|---|
| **CallingClient** | [`src/CallingClient/ai-docs/AGENTS.md`](../src/CallingClient/ai-docs/AGENTS.md) | [`src/CallingClient/ai-docs/ARCHITECTURE.md`](../src/CallingClient/ai-docs/ARCHITECTURE.md) | Core calling - registration, call lifecycle, media |

*Other modules (CallHistory, CallSettings, Contacts, Voicemail) are planned for future phases.*

---

## Contributing to AI Docs

When modifying the calling package:

1. **New public API** → Update the relevant module's `AGENTS.md`
2. **Architecture change** → Update the relevant module's `ARCHITECTURE.md`
3. **New module** → Create `ai-docs/AGENTS.md` and `ARCHITECTURE.md` in the module directory
4. **New pattern** → Add to `ai-docs/patterns/`
5. **New template** → Add to `ai-docs/templates/`

Always ensure documentation references actual code — no fabricated details.
