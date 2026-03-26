# Create AGENTS.md Template

> **Purpose**: Template for generating service-level AGENTS.md files optimized for LLM consumption.

---

## Pre-Generation Questions

Answer before writing:

1. **Package/Service Name**: What is this service called?
2. **Purpose**: What problem does this service solve? (1-2 sentences)
3. **Key Capabilities**: What are the main features? (3-5 bullets)
4. **Usage Examples**: What are the most common use cases?
5. **API Surface**: What methods/properties are exposed?
6. **Dependencies**: What does this service depend on?

---

## AGENTS.md Structure

```markdown
# [Service Name] - AI Agent Guide

> **Purpose**: [One sentence describing what this service does]

---

## Quick Start

[3-5 line code example showing most basic usage]

---

## Key Capabilities

- [Capability 1]: [Brief description]
- [Capability 2]: [Brief description]
- [Capability 3]: [Brief description]

---

## Usage Examples

### [Use Case 1]
```typescript
// Example code
```

### [Use Case 2]
```typescript
// Example code
```

---

## API Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `propertyName` | `Type` | Description |

### Methods

#### `methodName(params)`

Description of what this method does.

**Parameters**:
- `param1` (Type): Description
- `param2` (Type, optional): Description

**Returns**: `Promise<ReturnType>` - Description

**Example**:
```typescript
const result = await service.methodName({
  param1: 'value',
});
```

---

## Events (if applicable)

| Event | Data | When Emitted |
|-------|------|--------------|
| `event:name` | `EventData` | Description |

---

## Common Patterns

### [Pattern Name]
```typescript
// Pattern example
```

---

## Error Handling

Errors are thrown as `Error` with:
- `message`: Error description
- `data.reason`: Error reason code

```typescript
try {
  await service.method();
} catch (error) {
  console.error(error.message);
  console.error(error.data?.reason);
}
```

---

## Dependencies

- Requires: [dependency description]
- Used by: [what uses this service]

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [Pattern files](../../../ai-docs/patterns/) - Coding patterns
```

---

## Content Guidelines

### Purpose Section
- One clear sentence
- Focus on business value, not implementation

### Quick Start
- Show the happy path
- Minimal code to demonstrate value
- Include all required setup steps

### Examples
- Use realistic parameter values
- Show common variations
- Include error handling when relevant

### API Reference
- List all public methods
- Include parameter types and descriptions
- Show return types
- Provide example for each method

### Error Handling
- Document common error scenarios
- Show how to access error details

---

## Token Optimization Strategy

For LLM efficiency:
1. **AGENTS.md first**: Contains usage info (most commonly needed)
2. **ARCHITECTURE.md linked at end**: For deep technical questions
3. **Concise examples**: Just enough to demonstrate
4. **Tables for reference**: Quick scanning

---

## Validation Checklist

- [ ] Purpose is clear and concise
- [ ] Quick start works as-is
- [ ] All public methods documented
- [ ] Examples are realistic and working
- [ ] Error handling documented
- [ ] Links to ARCHITECTURE.md included
- [ ] No implementation details (save for ARCHITECTURE.md)

---

## Example: Services/Agent AGENTS.md

```markdown
# Agent Service - AI Agent Guide

> **Purpose**: Manage agent lifecycle including login, logout, and state changes.

---

## Quick Start

```typescript
const cc = webex.cc;
await cc.register();

// Login
await cc.stationLogin({
  teamId: 'team-123',
  loginOption: 'BROWSER',
});

// Set available
await cc.setAgentState({
  state: 'Available',
  auxCodeId: '0',
});
```

---

## Key Capabilities

- **Station Login**: Login with browser, extension, or dial number
- **Station Logout**: Logout from current station
- **State Management**: Change between Available/Idle states
- **Buddy Agents**: Retrieve list of available agents

---

## API Reference

### `stationLogin(params)`

Login agent to a station.

**Parameters**:
- `teamId` (string): Team to login to
- `loginOption` ('BROWSER' | 'EXTENSION' | 'AGENT_DN'): Device type
- `dialNumber` (string, optional): Required for EXTENSION/AGENT_DN

**Returns**: `Promise<StationLoginResponse>`

---

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.
```
