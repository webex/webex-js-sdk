# Config Service - AI Agent Guide

> **Purpose**: Fetch and aggregate agent configuration data from multiple API endpoints to build the Agent Profile.
>
> **Scope Authority**: This is the authoritative documentation for the **Config** service scope. See [Root AGENTS.md](../../../../AGENTS.md) for the orchestrator and cross-scope rules.

---

## Overview

The Config Service is an **internal service** that builds the comprehensive Agent Profile (`Profile` type) by:
1. Fetching user data
2. Fetching desktop profile
3. Fetching teams
4. Fetching aux codes (idle/wrapup codes)
5. Fetching organization settings
6. Aggregating all data into a single Agent Profile

The Agent Profile is the central configuration object required for an agent to operate within the contact center. It is built during the registration flow (`cc.register()`) and contains all the data an agent needs: identity, team assignments, dial plans, aux codes, login options, and feature flags. Once constructed, the Agent Profile is stored on the `ContactCenter` plugin instance as `this.agentConfig` and is used by other services (Agent, Task) throughout the session.

---

## Quick Usage

```typescript
// Config service is used internally during the registration flow.
// Inside cc.ts → connectWebsocket(), after WebSocket connection is established:
const agentId = data.agentId;
const orgId = this.$webex.credentials.getOrgId();
this.agentConfig = await this.services.config.getAgentConfig(orgId, agentId);

// The returned Agent Profile contains all agent configuration:
LoggerProxy.info(`Agent ID: ${this.agentConfig.agentId}`, {
  module: 'cc',
  method: 'connectWebsocket',
});
LoggerProxy.info(`Teams: ${this.agentConfig.teams}`, {
  module: 'cc',
  method: 'connectWebsocket',
});
```

---

## Key Capabilities

- **Agent Profile Aggregation**: Combines data from 8+ API endpoints
- **Aux Codes Fetching**: Gets all idle and wrapup codes with pagination
- **Team Data**: Retrieves agent's team assignments
- **Dial Plan**: Fetches number transformation rules
- **Outdial ANI**: Retrieves outbound caller ID options

---

## Agent Profile Object (Key Fields)

The Agent Profile is defined as the [`Profile`](../types.ts) type. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Unique agent identifier |
| `agentName` | string | Display name |
| `agentMailId` | string | Email address |
| `teams` | [`Team[]`](../types.ts) | Assigned teams |
| `defaultDn` | string | Default dial number |
| `idleCodes` | [`Entity[]`](../types.ts) | Available idle codes |
| `wrapupCodes` | [`Entity[]`](../types.ts) | Available wrapup codes |
| `webRtcEnabled` | boolean | WebRTC calling enabled |
| `loginVoiceOptions` | [`LoginOption[]`](../types.ts) | Available login types |
| `dialPlan` | [`DialPlan`](../types.ts) | Number transformation rules |
| `isOutboundEnabledForAgent` | boolean | Outbound calling allowed |
| `outDialEp` | string | Outbound entry point ID |

---

## Data Aggregation Flow

The following diagram shows how `getAgentConfig` orchestrates multiple API calls and combines their results into the Agent Profile via `parseAgentConfigs()`:

```
getUserUsingCI ────┐
                   │
getOrgInfo ────────┤
                   │
getOrganizationSetting ────┤
                   │
getTenantData ─────┼──► parseAgentConfigs() ──► Agent Profile
                   │
getAllAuxCodes ─────┤
                   │
getDesktopProfileById ─┤
                   │
getAllTeams ────────┤
                   │
getDialPlanData ───┘
```

---

## API Methods (Internal)

### `getAgentConfig(orgId, agentId)`

Main method that aggregates all configuration data into the Agent Profile.

**Returns**: `Promise<Profile>`

**Flow**:
1. Fetch user data (`getUserUsingCI`)
2. Fetch org info (`getOrgInfo`), settings (`getOrganizationSetting`), tenant data (`getTenantData`) in parallel
3. Fetch aux codes with pagination (`getAllAuxCodes`)
4. Fetch desktop profile (`getDesktopProfileById`), site info (`getSiteInfo`)
5. Fetch dial plan if enabled (`getDialPlanData`)
6. Fetch teams (`getAllTeams`)
7. Parse and combine all data (`parseAgentConfigs`)

---

### `getOutdialAniEntries(orgId, params)`

Fetch outbound ANI entries for caller ID selection.

**Parameters**:
- `orgId` (string): Organization ID
- `params.outdialANI` (string): Outdial ANI ID from Agent Profile
- `params.page` (number, optional): Page number
- `params.pageSize` (number, optional): Items per page
- `params.search` (string, optional): Search term

**Returns**: `Promise<OutdialAniEntriesResponse>`

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
| `Profile` | Complete Agent Profile |
| `CC_EVENTS` | All event constants |
| `CC_AGENT_EVENTS` | Agent-specific events |
| `CC_TASK_EVENTS` | Task-specific events |
| `AuxCode` | Idle/wrapup code definition |
| `Team` | Team configuration |
| `DesktopProfileResponse` | Desktop profile settings |
| `LoginOption` | Login types (BROWSER, EXTENSION, AGENT_DN) |

---

## Error Handling

All API methods within the config service throw errors on failure. Since `getAgentConfig` calls multiple sub-APIs (`getUserUsingCI`, `getOrgInfo`, `getOrganizationSetting`, `getTenantData`, `getAllAuxCodes`, `getDesktopProfileById`, `getAllTeams`, `getDialPlanData`, etc.) and awaits them via `Promise.all`, **a failure in any single sub-API will cause the entire Agent Profile fetch to fail**. There is no partial profile — either all data is successfully fetched and aggregated, or the operation throws.

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

- [Root AGENTS.md](../../../../AGENTS.md) - Orchestrator and cross-scope rules
- [types.ts](../types.ts) - Type definitions
- [Util.ts](../Util.ts) - Agent Profile parsing utilities
- [constants.ts](../constants.ts) - API endpoints
