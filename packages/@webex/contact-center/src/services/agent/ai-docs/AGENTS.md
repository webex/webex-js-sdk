# Agent Service - AI Agent Guide

> **Purpose**: Manage agent lifecycle including login, logout, state changes, and buddy agent queries.

---

## Quick Start

```typescript
const cc = webex.cc;

// Register and login
const profile = await cc.register();
await cc.stationLogin({
  teamId: profile.teams[0].teamId,
  loginOption: 'BROWSER',
});

// Set state to Available
await cc.setAgentState({
  state: 'Available',
  auxCodeId: '0',
});

// Get available agents for transfer
const buddies = await cc.getBuddyAgents({
  state: 'Available',
  mediaType: 'telephony',
});
```

---

## Key Capabilities

- **Station Login**: Login with browser (WebRTC), extension, or dial number
- **Station Logout**: Logout from current station with reason
- **State Management**: Toggle between Available/Idle states with aux codes
- **Buddy Agents**: Query available agents for consult/transfer
- **Silent Relogin**: Automatic re-authentication on reconnection

---

## API Reference

### Login Options

| Option | Description | Requires dialNumber |
|--------|-------------|---------------------|
| `BROWSER` | WebRTC softphone in browser | No |
| `EXTENSION` | Desk phone extension | Yes |
| `AGENT_DN` | Direct dial number | Yes |

### Methods

#### `cc.stationLogin(params)`

Login agent to a station.

**Parameters**:
- `teamId` (string): Team to login to
- `loginOption` ('BROWSER' | 'EXTENSION' | 'AGENT_DN'): Device type
- `dialNumber` (string, optional): Required for EXTENSION/AGENT_DN

**Returns**: `Promise<StationLoginResponse>`

**Example**:
```typescript
// Browser login
const response = await cc.stationLogin({
  teamId: 'team-123',
  loginOption: 'BROWSER',
});

// Extension login
const response = await cc.stationLogin({
  teamId: 'team-123',
  loginOption: 'EXTENSION',
  dialNumber: '1234',
});
```

---

#### `cc.stationLogout(params)`

Logout agent from station.

**Parameters**:
- `logoutReason` (string, optional): 'User requested logout' | 'Inactivity Logout' | 'User requested agent profile update'

**Returns**: `Promise<StationLogoutResponse>`

**Example**:
```typescript
await cc.stationLogout({
  logoutReason: 'User requested logout',
});
```

---

#### `cc.setAgentState(params)`

Change agent state (Available/Idle).

**Parameters**:
- `state` ('Available' | 'Idle'): New state
- `auxCodeId` (string): Auxiliary code ID
- `lastStateChangeReason` (string, optional): Reason for change
- `agentId` (string, optional): Agent ID (defaults to current agent)

**Returns**: `Promise<SetStateResponse>`

**Example**:
```typescript
// Go Available
await cc.setAgentState({
  state: 'Available',
  auxCodeId: '0',
});

// Go to Idle with specific code
await cc.setAgentState({
  state: 'Idle',
  auxCodeId: 'break-code-123',
  lastStateChangeReason: 'Coffee break',
});
```

---

#### `cc.getBuddyAgents(params)`

Get list of agents for consult/transfer.

**Parameters**:
- `state` (string, optional): Filter by state ('Available', 'Idle')
- `mediaType` (string): Media type filter ('telephony', 'chat', 'social', 'email')  
**Returns**: `Promise<BuddyAgentsResponse>`

**Example**:
```typescript
const response = await cc.getBuddyAgents({
  state: 'Available',
  mediaType: 'telephony',
});

response.data.agentList.forEach(agent => {
  console.log(`${agent.agentName} (${agent.state})`);
});
```

---

## Events

| Event | Type | Description |
|-------|------|-------------|
| `agent:stationLoginSuccess` | `StationLoginSuccessResponse` | Login succeeded |
| `agent:stationLoginFailed` | Error | Login failed |
| `agent:logoutSuccess` | `LogoutSuccess` | Logout succeeded |
| `agent:logoutFailed` | Error | Logout failed |
| `agent:stateChange` | `StateChangeSuccess` | State changed (any source) |
| `agent:stateChangeSuccess` | `StateChangeSuccess` | State change succeeded |
| `agent:stateChangeFailed` | Error | State change failed |
| `agent:multiLogin` | Object | Multi-login detected |
| `agent:reloginSuccess` | `ReloginSuccess` | Silent relogin succeeded |
| `agent:dnRegistered` | Object | DN registration complete |

### Event Usage

```typescript
cc.on('agent:stateChange', (event) => {
  console.log(`State: ${event.subStatus}, AuxCode: ${event.auxCodeId}`);
});

cc.on('agent:multiLogin', (event) => {
  console.warn('Another session detected');
});
```

---

## Agent States

The `AgentState` type (`'Available' | 'Idle' | 'RONA' | string`) is extensible -- the `string` union member allows backend-defined states beyond the known values listed below.

| State | SubStatus | Description |
|-------|-----------|-------------|
| LoggedIn | Available | Ready to receive tasks |
| LoggedIn | Idle | On break or not ready (uses aux code for sub-reason) |
| RONA | - | Rang but no answer; agent failed to accept offered task |
| LoggedOut | - | Not logged in |
| LoggedIn | *(custom)* | Additional org-specific states defined via aux codes |

> **Note**: `AgentState` is a union with `string`, so consumers should handle unknown state values gracefully rather than exhaustively matching only the known literals.

---

## Error Handling

```typescript
try {
  await cc.stationLogin(params);
} catch (error) {
  console.error('Login failed:', error.message);
  // Access error details
  if (error.data) {
    console.error('Field:', error.data.fieldName);
    console.error('Message:', error.data.message);
  }
}
```

### Common Error Reasons

| Reason | Description |
|--------|-------------|
| `DUPLICATE_LOCATION` | Extension/DN already in use |
| `INVALID_DIAL_NUMBER` | Invalid phone number format |
| `AGENT_NOT_FOUND` | Agent doesn't exist (silent relogin) |

---

## Dependencies

- Requires `cc.register()` to be called first
- Agent profile must be fetched before login
- WebRTC (BROWSER option) requires mercury connection

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [`cc.ts`](../../../cc.ts) - Main plugin implementation
- [`types.ts`](../types.ts) - Type definitions