# New Module - Pre-Implementation Questionnaire

> **Purpose**: Gather all required information before creating a new module.

---

## MANDATORY Questions (must have answers before coding)

### A. Module Identity

1. **Module name**: What should the module be called? (PascalCase, e.g., `CallRecording`, `PresenceManager`)
2. **Purpose**: One-sentence description of what this module does.
3. **Scope**: Is this a top-level module (like CallHistory) or a sub-module within an existing module?
4. **Parent module**: If sub-module, which module does it belong to?

### B. Public API

5. **Factory function**: What factory function creates this module? (e.g., `createCallRecordingClient`)
6. **Interface name**: What is the public interface? (e.g., `ICallRecording`)
7. **Public methods**: List each method with:
   - Name (camelCase)
   - Parameters (name: type)
   - Return type
   - Brief description
8. **Properties**: Any public properties exposed on the interface?
9. **Publicly exposed**: Should the interface and factory function be exported from `src/api.ts`?

### C. Configuration

10. **Config interface**: Does this module need its own configuration interface?
11. **Config parameters**: List each config parameter with name, type, and default.

### D. API Integration

12. **Backend service**: Which backend does this talk to? (Mobius, Janus, SCIM, etc.)
13. **API endpoints**: List each endpoint with:
    - HTTP method (GET, POST, PATCH, DELETE)
    - URL path
    - Request payload structure
    - Response payload structure
14. **Multi-backend**: Does this need backend connectors? (WXC, UCM, BroadWorks)
    - If yes, which backends?
    - What differs between backends?

### E. Events

15. **Event emission**: Does this module emit events?
    - If yes, list each event with key, payload type, and trigger condition.
    - Where should event keys be defined? (New enum or extend existing `COMMON_EVENT_KEYS`)
16. **Event listening**: Does this module listen to Mercury/WebSocket events?
    - If yes, which `MOBIUS_EVENT_KEYS`?

### F. Dependencies

17. **Webex SDK features used**: Which `webex.internal.*` features? (mercury, services, metrics, support, etc.)
18. **Shared services**: Does it use MetricManager, Logger, SDKConnector?
19. **External packages**: Any new npm dependencies needed?

### G. Error Handling

20. **Error class**: Does it need a new error class, or reuse existing? (CallingClientError, CallError, LineError)
21. **Error scenarios**: List key error conditions.

---

## OPTIONAL Questions

22. **Singleton**: Should this be a singleton (like MetricManager) or allow multiple instances?
23. **State management**: Does it manage any state (in-memory data, caches)?
24. **Polling/timers**: Does it need periodic operations (keepalive, polling)?
25. **Reference module**: Which existing module is most similar in structure?

---

## Output: Module Specification Summary

After gathering answers, produce this summary before proceeding:

```
## Module Specification

**Name**: [PascalCase name]
**Interface**: [IModuleName]
**Factory**: [createModuleNameClient(webex, config?)]
**Scope**: [top-level / sub-module of X]
**Export from api.ts**: [yes/no]

### File Structure
```
src/ModuleName/
├── ModuleName.ts          # Main class
├── types.ts               # Interfaces, types, enums
├── constants.ts           # Constants
├── ModuleName.test.ts     # Unit tests
├── fixtures.ts            # Test fixtures
├── [BackendConnector.ts]  # If multi-backend
└── ai-docs/               # If non-trivial
    ├── AGENTS.md
    └── ARCHITECTURE.md
```

### Public API
| Method | Parameters | Returns | Description |
|---|---|---|---|
| [method] | [params] | [type] | [desc] |

### API Endpoints
| Method | Path | Description |
|---|---|---|
| [HTTP] | [path] | [desc] |

### Events
| Event Key | Payload | Trigger |
|---|---|---|
| [key] | [type] | [when] |

### Dependencies
- [list]

Confirmed? (Yes / Adjust)
```
