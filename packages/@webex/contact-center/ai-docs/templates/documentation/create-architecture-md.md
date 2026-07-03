# Create ARCHITECTURE.md Template

> **Purpose**: Template for generating service-level ARCHITECTURE.md files with technical deep-dives.

---

## Pre-Generation Questions

Answer before writing:

1. **Component Overview**: What are the main components/classes?
2. **File Structure**: How are files organized?
3. **Data Flow**: How does data move through the system?
4. **Integration Points**: How does this integrate with other services?
5. **Key Sequences**: What are the important operation sequences?
6. **Troubleshooting**: What are common issues and solutions?

---

## ARCHITECTURE.md Structure

```markdown
# [Service Name] - Architecture

> **Purpose**: Technical documentation for the [service name] component.

---

## Component Overview

| Component | File | Responsibility |
|-----------|------|----------------|
| `ClassName` | `path/to/file.ts` | What it does |
| `ClassName2` | `path/to/file2.ts` | What it does |

---

## File Structure

> **Note:** The file structure listing typically belongs in the service's `AGENTS.md` (usage documentation), not in `ARCHITECTURE.md`. Include it here only if you need to reference specific files in the architecture discussion. Otherwise, link to the AGENTS.md file structure section.

```
services/[name]/
├── index.ts          # Main service export
├── types.ts          # Type definitions
├── constants.ts      # Constants
└── ai-docs/
    ├── AGENTS.md     # Usage documentation (file structure lives here)
    └── ARCHITECTURE.md # This file
```

---

## Data Flow

```mermaid
flowchart TD
    A[User Action] --> B[cc.methodName]
    B --> C[services.service.method]
    C --> D[WebSocket/HTTP Request]
    D --> E[Backend Response]
    E --> F[Event Emission]
```

---

## Sequence Diagrams

### [Operation Name]

```mermaid
sequenceDiagram
    participant App
    participant CC as ContactCenter
    participant Svc as Service
    participant WS as WebSocket
    participant BE as Backend
    
    App->>CC: methodName(params)
    CC->>Svc: service.method({data})
    Svc->>WS: Send request
    WS->>BE: WebSocket message
    BE-->>WS: Response event
    WS-->>Svc: Resolve promise
    Svc-->>CC: Return response
    CC-->>App: Promise resolves
```

---

## Key Patterns

### [Pattern Name]

Description of the pattern and why it's used.

```typescript
// Code example
```

---

## Integration Points

### With [Component]

How this service integrates with other components.

### With WebSocket

How WebSocket events are handled.

### With Metrics

What metrics are tracked.

---

## State Management

### Lifecycle States

```
[State 1] → [State 2] → [State 3]
     ↑                      ↓
     └──────────────────────┘
```

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| State1 | State2 | Action |

---

## Error Handling

### Error Types

| Error | Cause | Resolution |
|-------|-------|------------|
| `REASON_CODE` | Why it happens | How to fix |

### Error Flow

```mermaid
flowchart TD
    A[API Call] --> B{Success?}
    B -->|Yes| C[Track Success Metric]
    B -->|No| D[Cast to Failure]
    D --> E[Track Failure Metric]
    E --> F[getErrorDetails]
    F --> G[Log Error]
    G --> H[Upload Logs]
    H --> I[Throw Error]
```

---

## Troubleshooting

### [Issue]: [Symptom]

**Cause**: Why this happens

**Solution**: How to fix

**Example**:
```typescript
// Code showing the fix
```

---

## Related Files

- [Main implementation](../../path/to/file.ts)
- [Types](../../path/to/types.ts)
- [Tests](../../../../test/unit/spec/path/to/file.ts)
```

---

## Content Guidelines

### Component Overview
- List main classes/functions
- Include file paths
- Brief responsibility description

### Diagrams
- Use Mermaid for all diagrams
- Keep diagrams focused (not too complex)
- Include legends if needed

### Sequence Diagrams
- Show key operations
- Include error paths for critical flows
- Label all participants clearly

### Troubleshooting
- Document real issues encountered
- Provide concrete solutions
- Include code examples

---

## Mermaid Diagram Guidelines

### Flowchart
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Other Action]
```

### Sequence
```mermaid
sequenceDiagram
    participant A as ActorA
    participant B as ActorB
    A->>B: Message
    B-->>A: Response
```

### State
```mermaid
stateDiagram-v2
    [*] --> State1
    State1 --> State2
    State2 --> [*]
```

---

## Validation Checklist

- [ ] All components listed with files
- [ ] Data flow diagram included
- [ ] Key sequence diagrams present
- [ ] Error handling documented
- [ ] Troubleshooting section has real issues
- [ ] Mermaid diagrams render correctly
- [ ] Links to source files included

---

## Example: Task Service ARCHITECTURE.md

```markdown
# Task Service - Architecture

> Technical documentation for task lifecycle management.

---

## Component Overview

| Component | File | Responsibility |
|-----------|------|----------------|
| `TaskManager` | `task/TaskManager.ts` | Task lifecycle coordination |
| `contact` | `task/contact.ts` | Task operations (hold, transfer) |
| `dialer` | `task/dialer.ts` | Outbound call initiation |
| `AutoWrapup` | `task/AutoWrapup.ts` | Auto wrapup timer |

---

## Sequence: Incoming Task

```mermaid
sequenceDiagram
    participant WS as WebSocket
    participant TM as TaskManager
    participant CC as ContactCenter
    participant App as Application
    
    WS->>TM: AgentOfferContact event
    TM->>TM: Create Task object
    TM->>CC: emit task:incoming
    CC->>App: trigger task:incoming
    App->>App: Display incoming task UI
```

---

## Troubleshooting

### Issue: Task events not received

**Cause**: TaskManager listeners not registered

**Solution**: Ensure register() is called before login
```
