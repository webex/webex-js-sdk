# Config Service - AI Agent Guide

> **Legacy/reference-only.** Canonical SDD: [`config-spec.md`](config-spec.md). Use the package [manifest](../../../../.sdd/manifest.json) and [`SPEC_INDEX.md`](../../../../ai-docs/SPEC_INDEX.md) for routing; code and tests remain the behavioral referee.
>
> **Purpose**: Fetch and aggregate agent configuration data from multiple API endpoints to build the AgentProfile.
>
> **Legacy scope:** See [Root AGENTS.md](../../../../AGENTS.md) for the orchestrator and cross-scope rules.

---

## Overview

The Config Service is an **internal service** that builds the comprehensive AgentProfile (`Profile` type) by:
1. Fetching the user desktop-login aggregate (agent identity plus `agentProfile`)
2. Fetching the organization desktop-login aggregate (org info, org settings, tenant configuration, URL mappings, AI feature, Microsoft/Webex config)
3. Fetching teams
4. Fetching aux codes (idle/wrapup codes)
5. Fetching site and, when the agent profile enables it, dial-plan data
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

- **AgentProfile Aggregation**: Combines data from 6 API endpoints (5 when the agent profile disables dial plans)
- **Aux Codes Fetching**: Gets all idle and wrapup codes with pagination
- **Team Data**: Retrieves agent's team assignments
- **Dial Plan**: Fetches number transformation rules
- **Outdial ANI**: Retrieves outbound caller ID options (standalone, publicly exposed via `cc.ts`)
- **Multimedia Profile**: Fetches channel capacity and blending config (standalone, not yet publicly exposed)
- **Paginated Data Access**: `getListOfTeams` and `getListOfAuxCodes` support custom pagination independent of profile building. `getListOfTeams` takes a `userDbId` — the `user.dbId` carried by the user desktop-login aggregate, not the CI user id — rather than a list of team ids

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

The following diagram shows how `getAgentConfig` orchestrates six API calls and combines their results into the AgentProfile via `parseAgentConfigs()`:

```
getUserDesktopLoginConfig ──┐  (awaited first; supplies dbId, siteId, dialPlanEnabled)
                            │
getOrgDesktopLoginConfig ───┤  (org info, org settings, tenant config, urlMappings,
                            │   aiFeature, microsoftConfig, webexConfig)
getAllAuxCodes ─────────────┼──► parseAgentConfigs() ──► AgentProfile
                            │
getAllTeams ────────────────┤  (filtered by userId == user.dbId)
                            │
getSiteInfo ────────────────┤  (team → site fallback for multimediaProfileId)
                            │
getDialPlanData ────────────┘  (only when agentProfile.dialPlanEnabled)
```

---

## API Methods (Internal)

### `getAgentConfig(orgId, agentId)`

Main method that aggregates all configuration data into the AgentProfile.

**Returns**: `Promise<Profile>`

**Flow**:
1. Fire the user aggregate (`getUserDesktopLoginConfig`), the org aggregate (`getOrgDesktopLoginConfig`) and aux codes (`getAllAuxCodes`) in parallel
2. Await the user aggregate — it supplies `user.dbId`, `user.siteId` and `agentProfile.dialPlanEnabled`
3. Fetch site info (`getSiteInfo`) and teams filtered by `userId` (`getAllTeams`)
4. Fetch dial plan if `agentProfile.dialPlanEnabled` (`getDialPlanData`)
5. `Promise.all` the five remaining promises
6. Resolve `multimediaProfileId` from the team value, falling back to the site value
7. Parse and combine all data (`parseAgentConfigs`)

---

## Standalone APIs (Not Part of AgentProfile Building)

These methods exist in `AgentConfigService` but are **not** part of the `getAgentConfig()` aggregation flow. They can be used independently by applications.

| Method | Status | Returns | Description |
|--------|--------|---------|-------------|
| `getOutdialAniEntries(orgId, params)` | **Publicly exposed** via `cc.getOutdialAniEntries()` | `OutdialAniEntriesResponse` | Fetch outbound ANI entries for caller ID selection. Supports pagination and search via [`OutdialAniParams`](../types.ts). |
| `getMultimediaProfileById(orgId, multimediaProfileId)` | **Not exposed, never called** | `MultimediaProfileResponse` | Fetch channel capacities (chat, email, telephony, social) and blending config. Available but unused anywhere. |
| `getListOfTeams(orgId, page, pageSize, userDbId)` | Used internally by `getAllTeams()` | `ListTeamsResponse` | Single-page team fetch with pagination metadata, filtered by `user.dbId` (the wire field is `filter=userId==` but the value is the database id, not the CI user id). The filter value must stay unquoted — the quoted form returns HTTP 400. |
| `getListOfAuxCodes(orgId, page, pageSize, filter, attributes)` | Used internally by `getAllAuxCodes()` | `ListAuxCodesResponse` | Single-page aux code fetch with pagination metadata. Useful for custom pagination. |

Additionally, the following endpoints are defined in `constants.ts` `endPointMap` but are consumed by separate service classes, not by `AgentConfigService`:

| Endpoint | Used By | Description |
|----------|---------|-------------|
| `queueList` | [`Queue.ts`](../../Queue.ts) | Fetch contact service queues |
| `entryPointDialNumberList` | [`EntryPoint.ts`](../../EntryPoint.ts) | Fetch profile-scoped entry-point dial-number mappings |
| `addressBookEntries` | [`AddressBook.ts`](../../AddressBook.ts) | Fetch address book entries |

---

## Key Types

Types used by the config service, all defined in [`types.ts`](../types.ts):

| Type | Description |
|------|-------------|
| `Profile` | Final aggregated agent config returned by `getAgentConfig()` |
| `OrgDesktopLoginResponse` | Response from `getOrgDesktopLoginConfig()` — `organization`, `organizationSetting`, `tenantConfiguration`, `urlMappings`, `aiFeature`, `microsoftConfig`, `webexConfig` |
| `UserDesktopLoginResponse` | Response from `getUserDesktopLoginConfig()` — `user` and `agentProfile` sections |
| `AgentResponse` | `user` section of the user aggregate — agent metadata, `dbId`, `siteId`, `agentProfileId` |
| `AgentProfile` | `agentProfile` section of the user aggregate — layout, dial-plan enablement, login options |
| `TeamList` | Team record from API — `id`, `name`, `teamType`, `siteId`, `multiMediaProfileId` |
| `ListTeamsResponse` | Paginated wrapper around `TeamList[]` with `meta` for pagination |
| `OrgInfo` | Organization info — `tenantId`, timezone |
| `OrgSettings` | Org feature flags — `webRtcEnabled`, `sensitiveDataMaskingEnabled` |
| `TenantData` | Tenant-level config — inactivity timeout, `forceDefaultDn`, `outdialEnabled` |
| `SiteInfo` | Site config — `id`, `name`, `multimediaProfileId` |
| `OrgUrlMappings` | Keyed external URL mappings — `ACQUEON_API_URL`, `ACQUEON_CONSOLE_URL` |
| `MicrosoftConfig` | Org-level Microsoft presence config — `showUserDetails`, `stateSynchronization` |
| `WebexConfig` | Org-level Webex presence config — `showUserDetails`, `stateSynchronization` |
| `MultimediaProfileResponse` | Multimedia profile — channel capacities and settings |
| `AuxCode` | Auxiliary code record — `id`, `name`, `description`, `workTypeCode` |
| `ListAuxCodesResponse` | Paginated wrapper around `AuxCode[]` with `meta` |
| `DialPlanEntity` | Dial plan rule — regex pattern, prefix, strip digits, `active` |
| `Entity` | Basic entity info — `isSystem`, `name`, `id`, `description` |
| `WrapupData` | Wrap-up config — auto-wrapup settings, available wrapup codes |
| `OutdialAniParams` | Parameters for `getOutdialAniEntries()` — ANI ID, pagination, filtering |

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
| `AgentProfile` | Agent profile settings from the user aggregate |
| `LoginOption` | Login types (BROWSER, EXTENSION, AGENT_DN) |

---

## Error Handling

All API methods within the config service throw errors on failure. Since `getAgentConfig` calls multiple sub-APIs (`getUserDesktopLoginConfig`, `getOrgDesktopLoginConfig`, `getAllAuxCodes`, `getAllTeams`, `getSiteInfo`, `getDialPlanData`) and awaits them via `Promise.all`, **a failure in any single sub-API will cause the entire AgentProfile fetch to fail**. There is no partial profile — either all data is successfully fetched and aggregated, or the operation throws.

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
