# Contact Center SDK - Templates

> **Purpose**: Code generation templates for AI agents to create, modify, and document SDK components.

---

## Template Categories

| Category | Purpose | Use When |
|----------|---------|----------|
| **new-service/** | Creating new services (like AddressBook, Queue) | Adding new data/API services |
| **new-method/** | Adding methods to existing services | Extending service capabilities |
| **existing-service/** | Bug fixes and feature enhancements | Modifying existing code |
| **documentation/** | Generating AGENTS.md and ARCHITECTURE.md | Creating service-level docs |

---

## Template Directory Structure

```
templates/
├── README.md                    # This file
├── new-service/                 # New service creation
│   ├── 00-master.md             # Orchestrator
│   ├── 01-pre-questions.md      # Requirements gathering
│   ├── 02-code-generation.md    # Service class generation
│   ├── 03-integration.md        # Registration and exports
│   ├── 04-test-generation.md    # Test file generation
│   └── 05-validation.md         # Quality checklist
├── new-method/                  # New method addition
│   ├── 00-master.md             # Orchestrator
│   ├── 01-requirements.md       # Method requirements
│   ├── 02-implementation.md     # Code implementation
│   ├── 03-tests.md              # Test generation
│   └── 04-validation.md         # Quality checklist
├── existing-service/            # Modifications
│   ├── bug-fix.md               # Bug fix workflow
│   └── feature-enhancement.md   # Feature addition workflow
└── documentation/               # Doc generation
    ├── create-agents-md.md      # AGENTS.md template
    └── create-architecture-md.md # ARCHITECTURE.md template
```

---

## Quick Reference

### Creating a New Service
Start with: [`new-service/00-master.md`](new-service/00-master.md)

### Adding a New Method
Start with: [`new-method/00-master.md`](new-method/00-master.md)

### Fixing a Bug
Use: [`existing-service/bug-fix.md`](existing-service/bug-fix.md)

### Adding a Feature
Start with: [`existing-service/feature-enhancement.md`](existing-service/feature-enhancement.md)

**Important:** Feature template now includes a mandatory placement triage:
- if feature fits existing service -> continue feature-enhancement flow
- if feature needs standalone ownership -> reroute to [`new-service/00-master.md`](new-service/00-master.md)

### Creating Service Documentation
Use: [`documentation/create-agents-md.md`](documentation/create-agents-md.md)

---

## Template Usage Flow

```
1. Identify task type from AGENTS.md
       │
       ▼
2. Route to appropriate template
       │
       ▼
3. If task is "Add Feature", run feature placement triage (existing service vs new service)
       │
       ▼
4. Follow template step-by-step
       │
       ▼
5. Load relevant patterns as specified
       │
       ▼
6. Generate/modify code
       │
       ▼
7. Run validation checklist
       │
       ▼
8. Update documentation if needed
```
