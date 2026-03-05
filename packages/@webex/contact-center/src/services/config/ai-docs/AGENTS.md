# Config Service - AI Agent Guide

> **Purpose**: Usage guide for the agent configuration service — profile fetching, parsing, and data aggregation.

---

## Service Overview

The `AgentConfigService` (`config/index.ts`) aggregates agent profile data from multiple backend APIs into a single `Profile` object. It is called once during agent login and provides configuration data consumed by the rest of the SDK.

**Entry point**: `AgentConfigService.getAgentConfig(orgId, agentId): Promise<Profile>`

---

## When to Use This Service

| Task | Method | Notes |
|------|--------|-------|
| Fetch full agent profile on login | `getAgentConfig(orgId, agentId)` | Orchestrates all sub-calls |
| Fetch queues for outdial | `getQueues(orgId, queryParams)` | Standalone, not part of profile |
| Fetch entry points for outdial | `getEntryPoints(orgId, queryParams)` | Standalone, not part of profile |
| Fetch address book entries | `getAddressBookEntries(orgId, addressBookId, queryParams)` | Standalone |
| Fetch outdial ANI entries | `getOutdialAniEntries(orgId, params)` | Standalone |
| Update agent profile | `updateAgentProfile(orgId, agentId, data)` | Profile field updates |

---

## Key Files

| File | Purpose |
|------|---------|
| `config/index.ts` | `AgentConfigService` class — all API methods |
| `config/Util.ts` | `parseAgentConfigs` — aggregates raw API responses into `Profile` |
| `config/constants.ts` | `endPointMap` (URL builders), `DEFAULT_PAGE`, `DEFAULT_PAGE_SIZE`, method name constants |
| `config/types.ts` | All types: `Profile`, `AgentResponse`, `TeamList`, `OrgSettings`, `TenantData`, etc. |

---

## Architecture Reference

For data flow diagrams, API endpoint details, pagination patterns, and error handling, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Key Types

### Profile (returned by getAgentConfig)

The `Profile` type contains 30+ fields aggregated from multiple API responses. Key fields:

- `agentId` — CI user ID (from `userData.ciUserId`, NOT `userData.id`)
- `teams` — Team list
- `idleCodes` / `wrapupCodes` — Filtered auxiliary codes
- `webRtcEnabled` — Organization-level WebRTC setting
- `loginVoiceOptions` — Available login options from desktop profile
- `wrapUpData` — Auto wrapup configuration
- `isEndTaskEnabled` / `isEndConsultEnabled` — Tenant-level call control flags

### ConfigFlags (consumed by TaskFactory)

Derived from `Profile` after login:
```typescript
type ConfigFlags = {
  isEndTaskEnabled: boolean;
  isEndConsultEnabled: boolean;
  webRtcEnabled: boolean;
  autoWrapup: boolean;
};
```

---

## Known Issues

### Team type mismatch

`parseAgentConfigs` declares `teamData: Team[]` but receives `TeamList[]` at runtime. These are incompatible types:
- `Team` (config/types.ts): `{ teamId, teamName, desktopLayoutId? }`
- `TeamList` (config/types.ts): `{ id, name, teamType, ... }` (14 fields)

The data flows through without runtime error because the `teams` field is passed through to `Profile` without field-level access, but this is a type safety gap.

---

## Patterns

### Adding a new API method

Follow the existing method pattern in `index.ts`:
1. Add endpoint URL builder to `endPointMap` in `constants.ts`
2. Add method name to `METHODS` in `constants.ts`
3. Implement method in `index.ts` using the standard try/catch + LoggerProxy pattern
4. Add response type to `types.ts`

### Modifying the Profile

1. Add new fields to the `Profile` type in `types.ts`
2. Update `parseAgentConfigs` in `Util.ts` to populate the new field
3. If the field comes from a new API, add the API method first (see above)
