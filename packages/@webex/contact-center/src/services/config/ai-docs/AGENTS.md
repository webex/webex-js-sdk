# Config Service - AI Agent Guide

> **Purpose**: Fetch and aggregate agent configuration data from multiple API endpoints to build the AgentProfile.
>
> **Scope Authority**: This is the authoritative documentation for the **Config** service scope. See [Root AGENTS.md](../../../../AGENTS.md) for the orchestrator and cross-scope rules.

---

## Overview

The Config Service is an **internal service** that builds the comprehensive AgentProfile (`Profile` type) by:
1. Fetching user data
2. Fetching desktop profile
3. Fetching teams
4. Fetching aux codes (idle/wrapup codes)
5. Fetching organization settings
6. Aggregating all data into a single AgentProfile

The AgentProfile is the central configuration object required for an agent to operate within the contact center. It is built during the registration flow (`cc.register()`) and contains all the data an agent needs: identity, team assignments, dial plans, aux codes, login options, and feature flags. Once constructed, the AgentProfile is stored on the `ContactCenter` plugin instance as `this.agentConfig` and is used by other services (Agent, Task) throughout the session.


---

## File Structure

```
services/config/
├── index.ts          # AgentConfigService class
├── types.ts          # Profile, CC_EVENTS, types
├── constants.ts      # API endpoints, defaults
├── Util.ts           # parseAgentConfigs helper
└── ai-docs/
    ├── AGENTS.md     # Usage documentation
    └── ARCHITECTURE.md # This file
```

---

## Quick Usage

```typescript
// Config service is used internally during the registration flow.
// Inside cc.ts → connectWebsocket(), after WebSocket connection is established:
const agentId = data.agentId;
const orgId = this.$webex.credentials.getOrgId();
this.agentConfig = await this.services.config.getAgentConfig(orgId, agentId);

// The returned AgentProfile contains all agent configuration:
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

- **AgentProfile Aggregation**: Combines data from 8+ API endpoints
- **Aux Codes Fetching**: Gets all idle and wrapup codes with pagination
- **Team Data**: Retrieves agent's team assignments
- **Dial Plan**: Fetches number transformation rules
- **Outdial ANI**: Retrieves outbound caller ID options (standalone, publicly exposed via `cc.ts`)
- **Multimedia Profile**: Fetches channel capacity and blending config (standalone, not yet publicly exposed)
- **Paginated Data Access**: `getListOfTeams` and `getListOfAuxCodes` support custom pagination independent of profile building

---

## AgentProfile Object (Key Fields)

The AgentProfile is defined as the [`Profile`](../types.ts) type. This is not an exhaustive list — see [`types.ts`](../types.ts) for the full 50+ field definition. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Unique agent identifier |
| `agentName` | string | Display name |
| `agentMailId` | string | Email address |
| `teams` | [`TeamList[]`](../types.ts) | Assigned teams (runtime data from `getAllTeams()` — `Profile` type declares `Team[]` but actual objects are `TeamList` with `id`, `name`, `teamType`, `siteId`, etc.) |
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

The following diagram shows how `getAgentConfig` orchestrates multiple API calls and combines their results into the AgentProfile via `parseAgentConfigs()`:

```
getUserUsingCI ────────────┐
                           │
getOrgInfo ────────────────┤
                           │
getOrganizationSetting ────┤
                           │
getTenantData ─────────────┤
                           │
getURLMapping ─────────────┼──► parseAgentConfigs() ──► AgentProfile
                           │
getAllAuxCodes ─────────────┤
                           │
getDesktopProfileById ─────┤
                           │
getSiteInfo ───────────────┤  (computes multimediaProfileId)
                           │
getAllTeams ────────────────┤
                           │
getDialPlanData ───────────┘
```

---

## API Methods (Internal)

### `getAgentConfig(orgId, agentId)`

Main method that aggregates all configuration data into the AgentProfile.

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

## Standalone APIs (Not Part of AgentProfile Building)

These methods exist in `AgentConfigService` but are **not** part of the `getAgentConfig()` aggregation flow. They can be used independently by applications.

| Method | Status | Returns | Description |
|--------|--------|---------|-------------|
| `getOutdialAniEntries(orgId, params)` | **Publicly exposed** via `cc.getOutdialAniEntries()` | `OutdialAniEntriesResponse` | Fetch outbound ANI entries for caller ID selection. Supports pagination and search via [`OutdialAniParams`](../types.ts). |
| `getMultimediaProfileById(orgId, multimediaProfileId)` | **Not exposed, never called** | `MultimediaProfileResponse` | Fetch channel capacities (chat, email, telephony, social) and blending config. Available but unused anywhere. |
| `getListOfTeams(orgId, page, pageSize, filter)` | Used internally by `getAllTeams()` | `ListTeamsResponse` | Single-page team fetch with pagination metadata. Useful for custom pagination. |
| `getListOfAuxCodes(orgId, page, pageSize, filter, attributes)` | Used internally by `getAllAuxCodes()` | `ListAuxCodesResponse` | Single-page aux code fetch with pagination metadata. Useful for custom pagination. |

Additionally, the following endpoints are defined in `constants.ts` `endPointMap` but are consumed by separate service classes, not by `AgentConfigService`:

| Endpoint | Used By | Description |
|----------|---------|-------------|
| `queueList` | [`Queue.ts`](../../Queue.ts) | Fetch contact service queues |
| `entryPointList` | [`EntryPoint.ts`](../../EntryPoint.ts) | Fetch entry points |
| `addressBookEntries` | [`AddressBook.ts`](../../AddressBook.ts) | Fetch address book entries |

---

## Key Types

Types used by the config service, all defined in [`types.ts`](../types.ts):

| Type | Description |
|------|-------------|
| `Profile` | Final aggregated agent config returned by `getAgentConfig()` |
| `AgentResponse` | Raw response from `getUserUsingCI()` — agent metadata, teamIds, siteId, agentProfileId |
| `DesktopProfileResponse` | Desktop profile settings — layout, dial plan, login options |
| `TeamList` | Team record from API — `id`, `name`, `teamType`, `siteId`, `multiMediaProfileId` |
| `ListTeamsResponse` | Paginated wrapper around `TeamList[]` with `meta` for pagination |
| `OrgInfo` | Organization info — `tenantId`, timezone |
| `OrgSettings` | Org feature flags — `webRtcEnabled`, `sensitiveDataMaskingEnabled` |
| `TenantData` | Tenant-level config — inactivity timeout, `forceDefaultDn`, `outdialEnabled` |
| `SiteInfo` | Site config — `id`, `name`, `multimediaProfileId` |
| `URLMapping` | External URL mapping — `id`, `name`, `url` |
| `MultimediaProfileResponse` | Multimedia profile — channel capacities and settings |
| `AuxCode` | Auxiliary code record — `id`, `name`, `description`, `workTypeCode` |
| `ListAuxCodesResponse` | Paginated wrapper around `AuxCode[]` with `meta` |
| `DialPlanEntity` | Dial plan rule — regex pattern, prefix, strip digits |
| `Entity` | Basic entity info — `isSystem`, `name`, `id`, `description` |
| `WrapupData` | Wrap-up config — auto-wrapup settings, available wrapup codes |
| `OutdialAniParams` | Parameters for `getOutdialAniEntries()` — ANI ID, pagination, filtering |
| `Team` | Simplified team shape in `Profile` — `teamId`, `teamName`, `desktopLayoutId` |

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
| `Profile` | Complete AgentProfile |
| `CC_EVENTS` | All event constants |
| `CC_AGENT_EVENTS` | Agent-specific events |
| `CC_TASK_EVENTS` | Task-specific events |
| `AuxCode` | Idle/wrapup code definition |
| `Team` | Team configuration |
| `DesktopProfileResponse` | Desktop profile settings |
| `LoginOption` | Login types (BROWSER, EXTENSION, AGENT_DN) |

---

## Error Handling

All API methods within the config service throw errors on failure. Since `getAgentConfig` calls multiple sub-APIs (`getUserUsingCI`, `getOrgInfo`, `getOrganizationSetting`, `getTenantData`, `getAllAuxCodes`, `getDesktopProfileById`, `getAllTeams`, `getDialPlanData`, etc.) and awaits them via `Promise.all`, **a failure in any single sub-API will cause the entire AgentProfile fetch to fail**. There is no partial profile — either all data is successfully fetched and aggregated, or the operation throws.

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
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [types.ts](../types.ts) - Type definitions
- [Util.ts](../Util.ts) - AgentProfile parsing utilities
- [constants.ts](../constants.ts) - API endpoints
