# Contact Center SDK - Templates

> **Purpose**: Code generation templates for AI agents to create, modify, and document SDK components.

---

## Template Categories

| Category | Purpose | Use When |
|----------|---------|----------|
| **new-service/** | Creating new services (like AddressBook, Queue) | Adding new data/API services |
| **new-method/** | Adding methods to existing services | Extending service capabilities |
| **existing-service/** | Bug fixes, feature enhancements, and modifications to existing methods | Modifying existing code |
| **documentation/** | Generating AGENTS.md and ARCHITECTURE.md | Creating service-level docs |

---

## Template Directory Structure

```
templates/
├── README.md                    # This file
├── new-service/                 # New service creation
│   ├── 00-master.md             # Orchestrator
│   ├── 01-pre-questions.md      # Requirements gathering (STOP gate)
│   ├── 02-code-generation.md    # Service class generation
│   ├── 03-integration.md        # Registration and exports
│   ├── 04-test-generation.md    # Test file generation
│   └── 05-validation.md         # Quality checklist
├── new-method/                  # New method addition
│   ├── 00-master.md             # Orchestrator
│   ├── 01-requirements.md       # Method requirements (STOP gate)
│   ├── 02-implementation.md     # Code implementation
│   ├── 03-tests.md              # Test generation
│   └── 04-validation.md         # Quality checklist
├── existing-service/            # Modifications
│   ├── bug-fix.md               # Bug fix workflow (STOP gate in Section A)
│   └── feature-enhancement.md   # Feature addition / modify existing method (STOP gate in Step 0)
└── documentation/               # Doc generation
    ├── create-agents-md.md      # AGENTS.md template
    └── create-architecture-md.md # ARCHITECTURE.md template
```

---

## Quick Reference

### Creating a New Service (Task Type A)
Start with: [`new-service/00-master.md`](new-service/00-master.md)

### Adding a New Method (Task Type B)
Start with: [`new-method/00-master.md`](new-method/00-master.md)

### Fixing a Bug (Task Type C)
Use: [`existing-service/bug-fix.md`](existing-service/bug-fix.md)

### Adding a Feature (Task Type D)
Start with: [`existing-service/feature-enhancement.md`](existing-service/feature-enhancement.md)

**Important:** Feature template includes a mandatory placement triage:
- if feature fits existing service -> continue feature-enhancement flow
- if feature needs standalone ownership -> reroute to [`new-service/00-master.md`](new-service/00-master.md)

### Modifying an Existing Method (Task Type F)
Use: [`existing-service/feature-enhancement.md`](existing-service/feature-enhancement.md)

**Important:** When modifying an existing method (changing signature, parameters, return type, or behavior), use the feature-enhancement template but **skip Step 0 (Placement Triage)** since the method already exists. Start directly at Step 0B (Pre-Enhancement Questions).

### Creating Service Documentation (Task Type E)
Use: [`documentation/create-agents-md.md`](documentation/create-agents-md.md)

---

## Template Usage Flow

```
1. Classify task using root AGENTS.md decision tree (../../AGENTS.md)
       |
       v
2. Route to appropriate template
       |
       v
3. STOP — Present pre-questions to developer, wait for answers
       |
       v
4. Present Spec Summary to developer, wait for approval
       |
       v
5. If task is "Add Feature", run placement triage (existing vs new service)
       |
       v
6. Load relevant patterns as specified
       |
       v
7. Generate/modify code
       |
       v
8. Run validation checklist
       |
       v
9. Update documentation if needed
```
