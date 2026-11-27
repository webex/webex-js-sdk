# Config Service - AI Agent Guide

> **Purpose**: Fetch and aggregate agent configuration data from multiple API endpoints to build the agent Profile.

---

## Overview

The Config Service is an **internal service** that builds the comprehensive `Profile` object by:
1. Fetching user data
2. Fetching desktop profile
3. Fetching teams
4. Fetching aux codes (idle/wrapup codes)
5. Fetching organization settings
6. Aggregating all data into a single Profile

---

## Quick Usage

```typescript
// Config service is used internally during registration
const profile = await cc.register();

// Profile contains all agent configuration
console.log('Agent ID:', profile.agentId);
console.log('Teams:', profile.teams);
console.log('Idle Codes:', profile.idleCodes);
console.log('Wrapup Codes:', profile.wrapupCodes);
console.log('WebRTC Enabled:', profile.webRtcEnabled);
console.log('Login Options:', profile.loginVoiceOptions);
```

---

## Key Capabilities

- **Agent Profile Aggregation**: Combines data from 8+ API endpoints
- **Aux Codes Fetching**: Gets all idle and wrapup codes with pagination
- **Team Data**: Retrieves agent's team assignments
- **Dial Plan**: Fetches number transformation rules
- **Outdial ANI**: Retrieves outbound caller ID options

---

## Profile Object (Key Fields)

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Unique agent identifier |
| `agentName` | string | Display name |
| `agentMailId` | string | Email address |
| `teams` | Team[] | Assigned teams |
| `defaultDn` | string | Default dial number |
| `idleCodes` | Entity[] | Available idle codes |
| `wrapupCodes` | Entity[] | Available wrapup codes |
| `webRtcEnabled` | boolean | WebRTC calling enabled |
| `loginVoiceOptions` | LoginOption[] | Available login types |
| `dialPlan` | DialPlan | Number transformation rules |
| `isOutboundEnabledForAgent` | boolean | Outbound calling allowed |
| `outDialEp` | string | Outbound entry point ID |

---

## API Methods (Internal)

### `getAgentConfig(orgId, agentId)`

Main method that aggregates all configuration data.

**Returns**: `Promise<Profile>`

**Flow**:
1. Fetch user data (`getUserUsingCI`)
2. Fetch org info, settings, tenant data in parallel
3. Fetch aux codes with pagination
4. Fetch desktop profile, site info
5. Fetch dial plan (if enabled)
6. Fetch teams
7. Parse and combine all data

---

### `getOutdialAniEntries(orgId, params)`

Fetch outbound ANI entries for caller ID selection.

**Parameters**:
- `orgId` (string): Organization ID
- `params.outdialANI` (string): Outdial ANI ID from profile
- `params.page` (number, optional): Page number
- `params.pageSize` (number, optional): Items per page
- `params.search` (string, optional): Search term

**Returns**: `Promise<OutdialAniEntriesResponse>`

---

## Data Aggregation Flow

```
getUserUsingCI ────┐
                   │
getOrgInfo ────────┤
                   │
getOrgSettings ────┤
                   │
getTenantData ─────┼──► parseAgentConfigs() ──► Profile
                   │
getAuxCodes ───────┤
                   │
getDesktopProfile ─┤
                   │
getTeams ──────────┤
                   │
getDialPlan ───────┘
```

---

## Events (CC_EVENTS)

The config service defines event constants used throughout the SDK:

| Event Category | Examples |
|----------------|----------|
| Agent Events | WELCOME, AGENT_LOGOUT, AGENT_STATE_CHANGE |
| Task Events | AGENT_CONTACT, AGENT_OFFER_CONTACT, CONTACT_ENDED |
| Login Events | AGENT_STATION_LOGIN_SUCCESS, AGENT_STATION_LOGIN_FAILED |

See [`types.ts`](../types.ts) for complete list.

---

## Types Defined

Key types in `services/config/types.ts`:

| Type | Description |
|------|-------------|
| `Profile` | Complete agent profile |
| `CC_EVENTS` | All event constants |
| `CC_AGENT_EVENTS` | Agent-specific events |
| `CC_TASK_EVENTS` | Task-specific events |
| `AuxCode` | Idle/wrapup code definition |
| `Team` | Team configuration |
| `DesktopProfileResponse` | Desktop profile settings |
| `LoginOption` | Login types (BROWSER, EXTENSION, AGENT_DN) |

---

## Error Handling

Config service methods throw errors on API failures:

```typescript
try {
  const profile = await this.services.config.getAgentConfig(orgId, agentId);
} catch (error) {
  LoggerProxy.error(`Config fetch failed: ${error}`, {
    module: 'ConfigService',
    method: 'getAgentConfig',
  });
  throw error;
}
```

---

## Usage in cc.ts

```typescript
// In register() -> connectWebsocket()
const agentId = data.agentId;
const orgId = this.$webex.credentials.getOrgId();
this.agentConfig = await this.services.config.getAgentConfig(orgId, agentId);
```

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [types.ts](../types.ts) - Type definitions
- [Util.ts](../Util.ts) - Profile parsing utilities
- [constants.ts](../constants.ts) - API endpoints
