# Config — SPEC

> Start here → root [`AGENTS.md`](../../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../../ai-docs/ARCHITECTURE.md). This is the module's canonical specification.

## Metadata

| Field | Value |
|---|---|
| Module id | `config` |
| Source path(s) | `src/services/config` |
| Doc kind | Module spec |
| Coverage score | Partial (manifest-authoritative); 15/15 required document fields present |
| Generated from | `module-spec` @ SDLC template library `0.2.1` |
| generated_by / approved_by / updated_at | Codex generator / developer-approved desktop-login aggregate migration delta / 2026-10-05 |
| Validation status | Agent Wellness Break v0.4 delta independently validated by claude-code on 2026-09-07; coverage remains Partial until the remaining baseline promotion criteria are satisfied |

## Evidence Rules
Every requirement cites stable source and test file paths. Code/tests are the behavioral referee; routed source text supplies explicit intent and rationale. Missing or contradictory evidence blocks promotion.

## Source Material Register
| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| Reviewed prior module guides and architecture material | overview / architecture / API / tests | used and code-checked | Content is placed by meaning throughout this specification; exact routing remains in the manifest. |

## Overview
Config is one of nine confirmed Contact Center SDK modules. Own retrieval and aggregation of remote organization, agent, team, profile, auxiliary-code, dial-plan, and feature configuration. Existing reviewed documentation is migrated by meaning and code/tests remain the behavioral referee.

The Config Service is an **internal service** that builds the comprehensive AgentProfile (`Profile` type) by:

1. Fetching the user desktop-login aggregate (agent identity plus `agentProfile`)

2. Fetching the organization desktop-login aggregate (org info, org settings, tenant configuration, URL mappings, AI feature, Microsoft/Webex config)

3. Fetching teams

4. Fetching aux codes (idle/wrapup codes)

5. Fetching site and, when the agent profile enables it, dial-plan data

6. Aggregating all data into a single AgentProfile

The AgentProfile is the central configuration object required for an agent to operate within the contact center. It is built during the registration flow (`cc.register()`) and contains all the data an agent needs: identity, team assignments, dial plans, aux codes, login options, and feature flags. Once constructed, the AgentProfile is stored on the `ContactCenter` plugin instance as `this.agentConfig` and is used by other services (Agent, Task) throughout the session.

- **AgentProfile Aggregation**: Combines data from 6 API endpoints (5 when the agent profile disables dial plans)

- **Aux Codes Fetching**: Gets all idle and wrapup codes with pagination

- **Team Data**: Retrieves agent's team assignments

- **Dial Plan**: Fetches number transformation rules

- **Outdial ANI**: Retrieves outbound caller ID options (standalone, publicly exposed via `cc.ts`)

- **Multimedia Profile**: Fetches channel capacity and blending config (standalone, not yet publicly exposed)

- **Paginated Data Access**: `getListOfTeams` and `getListOfAuxCodes` support custom pagination independent of profile building. `getListOfTeams` takes a `userDbId` — the `user.dbId` carried by the user desktop-login aggregate, not the CI user id — rather than a list of team ids

## Purpose / Responsibility
Own retrieval and aggregation of remote organization, agent, team, profile, auxiliary-code, dial-plan, and feature configuration.

## Stack
TypeScript 5.4 REST client, Promise-based parallel aggregation, Jest 27.

## Folder / Package Structure
```text
src/services/config/
├── Util.ts
├── constants.ts
├── index.ts
├── types.ts
```

```text
services/config/
├── index.ts          # AgentConfigService class
├── types.ts          # Profile, CC_EVENTS, types
├── constants.ts      # API endpoints, defaults
├── Util.ts           # parseAgentConfigs helper
└── ai-docs/
    ├── AGENTS.md     # Usage documentation
    └── ARCHITECTURE.md # Preserved legacy migration source (non-canonical)
```

## Key Files (source of truth)
| File | Holds |
|---|---|
| `src/services/config/index.ts` | Authoritative Config implementation or contract source. |
| `src/services/config/Util.ts` | Authoritative Config implementation or contract source. |
| `src/services/config/types.ts` | Authoritative Config implementation or contract source. |
| `src/services/config/constants.ts` | Authoritative Config implementation or contract source. |

## Public Surface
| Surface | Contract | Source |
|---|---|---|
| `getAgentConfig(orgId, agentId)` | staged, all-or-nothing `Promise<Profile>` aggregation | `src/services/config/index.ts` |
| User/profile/site/team/aux-code fetches | typed REST methods including pagination helpers | `src/services/config/index.ts`, `src/services/config/types.ts` |
| `getOrgDesktopLoginConfig(orgId)` | `OrgDesktopLoginResponse` from `organization/{orgId}/desktop-login` | `src/services/config/index.ts`, `src/services/config/constants.ts` |
| `getUserDesktopLoginConfig(orgId, ciUserId)` | `UserDesktopLoginResponse` from `organization/{orgId}/v2/user/by-ci-user-id/{ciUserId}/desktop-login` | `src/services/config/index.ts`, `src/services/config/constants.ts` |
| `Profile.aiFeature` | optional `aiFeature` section of the organization aggregate, mapped by `parseAgentConfigs` | `src/services/config/Util.ts`, `src/services/config/types.ts` |
| Multimedia profile | `MultimediaProfileResponse` | `src/services/config/types.ts` |
| Organization masking | `OrgSettings.maskSensitiveData` | `src/services/config/types.ts`, `src/services/config/Util.ts` |
| Auxiliary-code list URL | includes `desktopProfileFilter=true` | `src/services/config/constants.ts` |
| Outdial ANI entries | public wrapper through ContactCenter | `src/services/config/index.ts`, `src/cc.ts` |
| `Profile.isWellnessBreakEnabled` | required effective flag derived from backend AI feature configuration and organization license quantity | `src/services/config/Util.ts`, `src/services/config/types.ts` |
| `getWellbeingBreakIdleCode(orgId)` | paginated exact lookup for the active system idle code named `WellbeingBreak`, exposed and registration-cached by ContactCenter | `src/services/config/index.ts`, `src/services/config/constants.ts`, `src/cc.ts` |

The service has no `TeamList.channelMap` contract. Exact package exports are indexed in root `CONTRACTS.md`.

## Requires (dependencies)
- WebexRequest
- WCC organization/profile/team/site/tenant APIs
- ContactCenter registration flow

## Requirements
| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| CONFIG-R-001 | Fetch the user desktop-login aggregate first, then aggregate five dependent promises: the organization desktop-login aggregate, auxiliary codes, teams, site, and the conditional dial plan. | Dependent IDs and all-or-nothing consistency require staged orchestration. | `src/services/config/index.ts` | `test/unit/spec/services/config/index.ts` | None; source and test evidence rechecked during the 2026-07-09 remediation; independent document revalidation pending. | PRESENT |
| CONFIG-R-002 | Include the organization aggregate's `aiFeature` section in `parseAgentConfigs` so `Profile.aiFeature` reflects the organization feature contract. | ApiAIAssistant behavior is gated by the remote organization feature contract. | `src/services/config/index.ts` | `test/unit/spec/services/config/index.ts` | None; source and test evidence rechecked during the 2026-07-09 remediation; independent document revalidation pending. | PRESENT |
| CONFIG-R-003 | Paginate teams and auxiliary codes until completion and include `desktopProfileFilter=true` for auxiliary-code requests. | A partial or unfiltered set yields invalid profile/team/auxiliary choices. | `src/services/config/constants.ts` | `test/unit/spec/services/config/index.ts` | None; source and test evidence rechecked during the 2026-07-09 remediation; independent document revalidation pending. | PRESENT |
| CONFIG-R-004 | Expose current response/field names: `MultimediaProfileResponse`, `OrgSettings.maskSensitiveData`, and real TeamList fields only. | Type-name drift causes invalid consumer code and incorrect privacy behavior. | `src/services/config/types.ts` | `test/unit/spec/services/config/index.ts` | None; source and test evidence rechecked during the 2026-07-09 remediation; independent document revalidation pending. | PRESENT |
| CONFIG-R-005 | Reject the entire profile aggregation when any required dependent request fails. | Consumers must never receive an internally inconsistent partial Profile. | `src/services/config/index.ts` | `test/unit/spec/services/config/index.ts` | None; source and test evidence rechecked during the 2026-07-09 remediation; independent document revalidation pending. | PRESENT |
| CONFIG-R-006 | Always populate `Profile.isWellnessBreakEnabled`; set it true only when `agentWellbeing.enable` is true, `wellnessBreakReminders` is `ENABLED`, and `OrgSettings.aiAssistantQuantity` is greater than zero. Missing or null inputs fail closed. | Hosts need one license-and-server-rollout-aware signal rather than reconstructing partial configuration. | `src/services/config/Util.ts`, `src/services/config/types.ts` | `test/unit/spec/services/config/Util.ts` | The supported SDK contracts expose no separate rollout response field; backend delivery of enabled `agentWellbeing` configuration is the rollout decision. | PRESENT |
| CONFIG-R-007 | Retrieve the wellness idle code from `/v2/auxiliary-code` using `workType=IDLE_CODE`, `customFilter=isSystemCode==true`, and `desktopProfileFilter=false`; follow pagination and accept only the exact active system code name `WellbeingBreak`. | The dedicated state must be independent of desktop-profile filtering and must never fall back to a similarly named or non-system code. | `src/services/config/index.ts`, `src/services/config/constants.ts` | `test/unit/spec/services/config/index.ts` | None. | PRESENT |

## Design Overview
Config separates its stable consumption boundary from collaborators so ownership and failure behavior stay explicit. Profile creation is all-or-nothing across dependent API calls so consumers never receive internally inconsistent partial configuration.

> **Purpose**: Fetch and aggregate agent configuration data from multiple API endpoints to build the AgentProfile.
>
> **Scope Authority**: This is the authoritative documentation for the **Config** service scope. See [Root AGENTS.md](../../../../AGENTS.md) for the orchestrator and cross-scope rules.

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

The AgentProfile is defined as the [`Profile`](../types.ts) type. This is not an exhaustive list — see [`types.ts`](../types.ts) for the full 50+ field definition. Key fields:

| Field | Type | Description |
|---|---|---|
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
| `allowConsultToQueue` | boolean | Whether consult-to-queue is enabled on the Desktop Profile |
| `accessQueue` | `'ALL' \| 'SPECIFIC' \| 'NONE'` | Collaboration tab queue access scope from Desktop Profile |
| `accessEntryPoint` | `'ALL' \| 'SPECIFIC' \| 'NONE'` | Collaboration tab entry-point access scope from Desktop Profile |
| `accessBuddyTeam` | `'ALL' \| 'SPECIFIC' \| 'NONE'` | Collaboration tab buddy-team access scope from Desktop Profile |
| `isWellnessBreakEnabled` | boolean | Effective wellness gate derived from backend enablement/reminder configuration and positive AI Assistant license quantity |

`parseAgentConfigs()` maps the three `access*` fields from the user aggregate's `AgentProfile` section onto the public `Profile` returned by `cc.register()`.

The following diagram shows how `getAgentConfig` orchestrates six API calls and combines their results into the AgentProfile via `parseAgentConfigs()`:

```text
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

Types used by the config service, all defined in [`types.ts`](../types.ts):

| Type | Description |
|---|---|
| `Profile` | Final aggregated agent config returned by `getAgentConfig()` |
| `OrgDesktopLoginResponse` | Response from `getOrgDesktopLoginConfig()` — `organization`, `organizationSetting`, `tenantConfiguration`, `urlMappings`, `aiFeature`, `microsoftConfig`, `webexConfig` |
| `UserDesktopLoginResponse` | Response from `getUserDesktopLoginConfig()` — `user` and `agentProfile` sections |
| `AgentResponse` | `user` section of the user aggregate — agent metadata, `dbId`, `siteId`, `agentProfileId` |
| `AgentProfile` | `agentProfile` section of the user aggregate — layout, dial-plan enablement, login options |
| `TeamList` | Team record from API — `id`, `name`, `teamType`, `siteId`, `multiMediaProfileId` |
| `ListTeamsResponse` | Paginated wrapper around `TeamList[]` with `meta` for pagination |
| `OrgInfo` | Organization info — `tenantId`, timezone |
| `OrgSettings` | Org feature flags — `webRtcEnabled`, `maskSensitiveData` |
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

```typescript
// In register() -> connectWebsocket()
const agentId = data.agentId;
const orgId = this.$webex.credentials.getOrgId();
this.agentConfig = await this.services.config.getAgentConfig(orgId, agentId);
```

> **Purpose**: Technical documentation for agent configuration aggregation.

For endpoints with pagination (teams, aux codes):

```typescript
import {DEFAULT_PAGE} from './constants'; // DEFAULT_PAGE = 0

public async getAllTeams(orgId, pageSize, userDbId): Promise<TeamList[]> {
  let allTeams: TeamList[] = [];
  let page = DEFAULT_PAGE;

  // First request to get totalPages
  const firstResponse = await this.getListOfTeams(orgId, page, pageSize, userDbId);
  allTeams = allTeams.concat(firstResponse.data);
  const totalPages = firstResponse.meta.totalPages;

  // Parallel requests for remaining pages
  const requests = [];
  for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
    requests.push(this.getListOfTeams(orgId, page, pageSize, userDbId));
  }

  const responses = await Promise.all(requests);
  for (const response of responses) {
    allTeams = allTeams.concat(response.data);
  }

  return allTeams;
}
```

`parseAgentConfigs` in Util.ts combines all data into a unified `Profile` object. See [types.ts](../types.ts) for full type definitions.

The service fetches data from multiple APIs with these response structures:

| API Method | Response Type | Key Fields | Usage |
|---|---|---|---|
| `getUserDesktopLoginConfig` | `UserDesktopLoginResponse` | `user`: `ciUserId`, `id`, `dbId`, `firstName`, `lastName`, `email`, `agentProfileId`, `siteId`. `agentProfile`: `dialPlanEnabled`, `accessWrapUpCode`, `accessIdleCode`, `loginVoiceOptions`, `viewableStatistics` | Agent identity, team-filter id, site reference, and desktop settings in one call |
| `getOrgDesktopLoginConfig` | `OrgDesktopLoginResponse` | `organization`: `tenantId`, `timezone`. `organizationSetting`: `webRtcEnabled`, `maskSensitiveData`, `campaignManagerEnabled`, `aiAssistantQuantity`. `tenantConfiguration`: `outdialEnabled`, `forceDefaultDn`, `privacyShieldVisible`, `timeoutDesktopInactivityEnabled`. Optional `urlMappings`, `aiFeature`, `microsoftConfig`, `webexConfig` | All organization-, tenant- and feature-scoped configuration in one call |
| `getAllTeams` | `TeamList[]` | real `TeamList` fields from `src/services/config/types.ts` | Team identity, name, type, and site assignment; channel capacities belong to `MultimediaProfileResponse` |
| `getAllAuxCodes` | `AuxCode[]` | `id`, `name`, `workTypeCode`, `active`, `isSystemCode`, `defaultCode` | Auxiliary codes for idle/wrap-up states |
| `getDialPlanData` | `DialPlanEntity[]` | `id`, `name`, `regularExpression`, `prefix`, `strippedChars`, `active` | Dial plan rules for outbound calling |
| `getSiteInfo` | `SiteInfo` | Site-specific configuration | Site details, including the `multimediaProfileId` fallback |

These responses are parsed and aggregated into a single `Profile` object by the `parseAgentConfigs` function.

```typescript
// See full implementation in Util.ts
function parseAgentConfigs(profileData: {
  orgConfig: OrgDesktopLoginResponse;   // See types.ts:OrgDesktopLoginResponse
  userData: AgentResponse;              // `user` section; see types.ts:AgentResponse
  agentProfileData: AgentProfile;       // `agentProfile` section; see types.ts:AgentProfile
  teamData: TeamList[];                 // See types.ts:TeamList
  auxCodes: AuxCode[];                  // See types.ts:AuxCode
  dialPlanData: DialPlanEntity[];       // See types.ts:DialPlanEntity
  multimediaProfileId: string;
}): Profile {                           // See types.ts:Profile
  const { orgConfig, userData, agentProfileData, teamData, auxCodes,
          dialPlanData } = profileData;
  const {
    organization: orgInfoData,
    organizationSetting: orgSettingsData,
    tenantConfiguration: tenantData,
    urlMappings,
    aiFeature,
    microsoftConfig,
    webexConfig,
  } = orgConfig;

  // Aux code filtering via getFilterAuxCodes():
  //   - checks auxCode.workTypeCode and auxCode.active
  //   - the aggregate returns the full org pool, so no per-agent restriction is applied
  //   - maps to Entity {id, name, isSystem, isDefault}
  const wrapupCodes = getFilterAuxCodes(auxCodes, WRAP_UP_CODE);
  const idleCodes = getFilterAuxCodes(auxCodes, IDLE_CODE);

  // Hardcoded "Available" state always appended to idle codes
  idleCodes.push({ id: '0', name: 'Available', isSystem: false, isDefault: false });

  return {
    agentId: userData.ciUserId,          // NOTE: uses ciUserId for agent identification
    analyserUserId: userData.id,         // NOTE: userData.id is used for analytics/reporting
    agentName: `${userData.firstName} ${userData.lastName}`,
    teams: teamData,                     // TeamList[] straight from the team API; Profile.teams is TeamList[]
    idleCodes,                           // NOTE: Filtered via getFilterAuxCodes() + hardcoded "Available" state
    wrapupCodes,                         // NOTE: Filtered via getFilterAuxCodes()
    webRtcEnabled: orgSettingsData.webRtcEnabled,
    loginVoiceOptions: agentProfileData.loginVoiceOptions ?? [],
    enterpriseId: orgInfoData.tenantId,
    tenantTimezone: orgInfoData.timezone,
    multimediaProfileId: profileData.multimediaProfileId,
    aiFeature,
    // ... 30+ more fields — see Util.ts for full implementation
  };
}
```

## Data Flow
```mermaid
flowchart TD
  Start[getAgentConfig orgId + agentId] --> User[getUserDesktopLoginConfig awaited first]
  Start --> Org[getOrgDesktopLoginConfig]
  Start --> Aux[getAllAuxCodes]
  User --> Site[getSiteInfo siteId]
  User --> Teams[getAllTeams filtered by dbId]
  User --> Dial{agentProfile.dialPlanEnabled?}
  Dial -->|yes| DialPlan[getDialPlanData]
  Dial -->|no| Empty[empty dial plan]
  Site --> All[Promise.all of five result promises]
  Teams --> All
  DialPlan --> All
  Empty --> All
  Org --> All
  Aux --> All
  All --> Mm[multimediaProfileId: team value else site value]
  Mm --> Parse[parseAgentConfigs with orgConfig + userData + agentProfileData]
  Parse --> Result[Profile with aiFeature + maskSensitiveData]
```

## Sequence Diagram(s)
Sequence coverage:

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| Profile aggregation and AI feature flags | Profile aggregation | Any required request rejection rejects `getAgentConfig`; no partial Profile is returned. |
| Team/aux-code pagination | Pagination | Continue until page metadata is exhausted; any page rejection rejects the operation. |

AI-feature retrieval shares the same actors, ordering, Promise aggregation, and all-or-nothing failure outcome as the other profile dependencies, so it is represented in the Profile aggregation diagram rather than duplicated.

### Profile aggregation

```mermaid
sequenceDiagram
  participant CC as ContactCenter
  participant Cfg as AgentConfigService
  participant API as WCC APIs
  participant Util as parseAgentConfigs
  CC->>Cfg: getAgentConfig(orgId, agentId)
  par requests started before user data resolves
    Cfg->>API: getUserDesktopLoginConfig
    Cfg->>API: getOrgDesktopLoginConfig
    Cfg->>API: getAllAuxCodes
  end
  API-->>Cfg: user.dbId / user.siteId / agentProfile.dialPlanEnabled
  par user-dependent requests
    Cfg->>API: getSiteInfo + getAllTeams(filter userId==dbId)
    Cfg->>API: conditional dial plan gated on agentProfile.dialPlanEnabled
  end
  Note over Cfg,API: Promise.all awaits 5 result promises after the user aggregate
  alt all succeed
    API-->>Cfg: five results
    Cfg->>Util: parseAgentConfigs(orgConfig, userData, agentProfileData, ...)
    Util-->>CC: Profile including aiFeature
  else any fails
    Cfg-->>CC: throw; no partial Profile
  end
```

### Pagination

```mermaid
sequenceDiagram
  participant Caller
  participant Cfg as AgentConfigService
  participant WR as WebexRequest
  participant API as WCC API
  Caller->>Cfg: getAllTeams(orgId, pageSize, userDbId) / getAllAuxCodes(orgId, pageSize, filters)
  Cfg->>WR: request page 0
  WR->>API: authenticated GET
  alt first page succeeds
    API-->>Cfg: page 0 data + meta.totalPages
    par remaining pages 1..totalPages-1
      Cfg->>WR: Promise.all(page requests)
      WR->>API: authenticated GETs
      API-->>Cfg: remaining page responses
    end
    alt every remaining page succeeds
      Cfg->>Cfg: concatenate responses in request order
      Cfg-->>Caller: complete accumulated list
    else any remaining page rejects
      Cfg-->>Caller: reject; do not return a partial list
    end
  else first page rejects
    Cfg-->>Caller: reject
  end
```

## Class / Component Relationships
```mermaid
classDiagram
  class ContactCenter
  class AgentConfigService
  class WebexRequest
  class parseAgentConfigs
  class Profile
  ContactCenter --> AgentConfigService : getAgentConfig
  AgentConfigService --> WebexRequest : six dependent requests
  AgentConfigService --> parseAgentConfigs : aggregate results
  parseAgentConfigs --> Profile : aiFeature + maskSensitiveData
```

| Component | File | Responsibility |
|---|---|---|
| `AgentConfigService` | `config/index.ts` | Main config service class |
| `parseAgentConfigs` | `config/Util.ts` | Profile parsing/aggregation |
| `endPointMap` | `config/constants.ts` | API endpoint definitions |
| `types` | `config/types.ts` | Types, events, interfaces |

## Use Cases
- **UC-1 Two-wave profile aggregation:** retrieve the user desktop-login aggregate first, run five dependent promises including the organization aggregate, then parse one complete Profile or reject the whole operation. Evidence: `src/services/config/index.ts`, `src/services/config/Util.ts`, `test/unit/spec/services/config/index.ts`.
- **UC-2 Paginated teams/aux codes:** follow backend page metadata to completion; auxiliary-code requests include `desktopProfileFilter=true`. Evidence: `src/services/config/index.ts`, `test/unit/spec/services/config/index.ts`.
- **UC-3 Dial plan and URL mappings:** request dial-plan data only when the agent profile enables it, keep only `active` plans, and map the organization aggregate's `urlMappings` into the profile. Evidence: `src/services/config/index.ts`, `src/services/config/Util.ts`, `test/unit/spec/services/config/index.ts`.
- **UC-4 Outdial ANI retrieval:** return the organization-scoped ANI list through authenticated WebexRequest and propagate failures without a partial substitute. Evidence: `src/services/config/index.ts`, `test/unit/spec/services/config/index.ts`.
- **UC-5 Wellness configuration:** produce one fail-closed effective profile flag and retrieve the exact system wellness idle code across pages. Evidence: `src/services/config/Util.ts`, `src/services/config/index.ts`, `test/unit/spec/services/config/Util.ts`, `test/unit/spec/services/config/index.ts`.

## Business Rules & Invariants
- `getAgentConfig` rejects when any required dependent request rejects; it never returns a partial Profile.
- `Profile.aiFeature` is derived from the AI-feature response, and sensitive-data masking uses the real `maskSensitiveData` field.
- Team data has no `channelMap` contract; multimedia profile responses use `MultimediaProfileResponse`.
- `isWellnessBreakEnabled` is always boolean and defaults false when any gate is absent, disabled, or unlicensed.
- The system wellness code lookup is separate from profile auxiliary-code aggregation and uses `desktopProfileFilter=false`.

## Concurrency & Reactive Flow
- The initial user desktop-login lookup supplies identifiers for a five-promise `Promise.all`; pagination loops await pages in order and stop from returned metadata.

## Protocol / Wire Format
All Config operations are authenticated REST calls through WebexRequest. Important current routes include:

| Operation | Resource shape |
|---|---|
| Organization desktop-login aggregate | `organization/{orgId}/desktop-login` |
| User desktop-login aggregate | `organization/{orgId}/v2/user/by-ci-user-id/{ciUserId}/desktop-login` |
| Teams | `organization/{orgId}/v2/team?page={page}&pageSize={pageSize}&agentView=true&filter=userId=={userDbId}` — the wire field is `userId` but the value is the user's database id; filter value unquoted, no `attributes=` projection |
| Auxiliary codes | pagination/filter/attributes plus `desktopProfileFilter=true` |
| Wellness system idle code | `organization/{orgId}/v2/auxiliary-code?page={page}&pageSize={pageSize}&workType=IDLE_CODE&customFilter=isSystemCode==true&desktopProfileFilter=false` |
| Multimedia profile | organization-scoped multimedia-profile resource |
| Dial plan | organization-scoped dial-plan resource when the agent profile enables it |

Exact resources live in `src/services/config/constants.ts`; response/profile fields live in `src/services/config/types.ts`.

## Error Handling & Failure Modes
| Condition | Signal (error/code/result) | Caller recovery |
|---|---|---|
| Dependency rejection | Typed/rethrown error or failure event | Inspect structured details, preserve tracking id, and retry only when the operation is safe. |
| Timeout or missing async completion | Timeout/recovery state | Follow the module-specific recovery path; never synthesize success. |

All API methods within the config service throw errors on failure. After `getUserDesktopLoginConfig`, `getAgentConfig` awaits five dependent requests via `Promise.all`: site, conditional dial plan, teams, the organization desktop-login aggregate, and all auxiliary codes. A failure in any required request, including `getOrgDesktopLoginConfig`, causes the entire AgentProfile fetch to fail. There is no partial profile — either all data is successfully fetched and aggregated, or the operation throws.

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

Each method follows consistent error handling:

```typescript
public async getUserDesktopLoginConfig(
  orgId: string,
  ciUserId: string
): Promise<UserDesktopLoginResponse> {
  LoggerProxy.info('Fetching user desktop-login configuration', {
    module: CONFIG_FILE_NAME,
    method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
  });

  try {
    const resource = endPointMap.userDesktopLogin(orgId, ciUserId);
    const response = await this.webexReq.request({
      service: WCC_API_GATEWAY,
      resource,
      method: HTTP_METHODS.GET,
    });

    if (response.statusCode !== 200) {
      throw new Error(`API call failed with ${response.statusCode}`);
    }

    LoggerProxy.log('getUserDesktopLoginConfig api success.', {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
    });

    return Promise.resolve(response.body);
  } catch (error) {
    LoggerProxy.error(`getUserDesktopLoginConfig API call failed with ${error}`, {
      module: CONFIG_FILE_NAME,
      method: METHODS.GET_USER_DESKTOP_LOGIN_CONFIG,
    });
    throw error;
  }
}
```

**Cause**: One of the parallel API calls failed (network error, 401/403/404/500 response)

**Log patterns to search for:**

```typescript
// General config failure
"getAgentConfig call failed"
"module": "config/index.ts", "method": "getAgentConfig"

// Specific API method failures
"getUserDesktopLoginConfig API call failed"
"getOrgDesktopLoginConfig API call failed"
"getAllTeams API call failed"
"getAllAuxCodes API call failed"

// Look for HTTP error codes
"API call failed with 401"  // Authentication
"API call failed with 403"  // Authorization
"API call failed with 404"  // Not found
"API call failed with 500"  // Server error
```

**Solution**:

1. Check logs for specific API that failed

2. Verify orgId and agentId are correct

3. Ensure authentication tokens are valid

4. Check network connectivity to WCC API Gateway

**Cause**: Pagination not completing or filter parameters incorrect

**Log patterns:**

```typescript
"getAllTeams API call failed"
"getAllAuxCodes API call failed"
"method": "getListOfTeams"
"method": "getListOfAuxCodes"
```

**Solution**:

1. Check `totalPages` in first response

2. Verify the team filter carries a valid `userDbId` (`user.dbId`, not the CI user id) and that aux-code filters contain valid IDs

3. Check if pageSize is appropriate (default: 100)

4. Ensure all pages are fetched in Promise.all()

**Cause**: Organization or tenant settings have feature disabled

**Log patterns:**

```typescript
"getOrgDesktopLoginConfig api success."
"getUserDesktopLoginConfig api success."
```

**Solution**:

1. Check `orgSettingsData.webRtcEnabled` in response

2. Check `tenantData.outdialEnabled` for outbound features

3. Verify feature is enabled in admin portal settings

4. Confirm agentProfileData has correct feature flags

**Cause**: `dialPlanEnabled` is false in desktop profile

**Solution**:

1. Check `agentProfileData.dialPlanEnabled` value

2. Verify dial plans are assigned in agent profile configuration

3. Note: dial plan fetch only happens if `dialPlanEnabled === true`

**Cause**: Expected auxiliary codes missing from the returned pool

**Log patterns:**

```typescript
"method": "getFilterAuxCodes"
```

**Solution**:

1. `getFilterAuxCodes` no longer applies a per-agent restriction list — the full organization pool is returned for every agent

2. `Profile.idleCodesAccess` / `wrapupCodesAccess` still report `ALL` or `SPECIFIC` from `agentProfileData`

3. Ensure aux codes have `active: true` status and the expected `workTypeCode`

4. Note: "Available" state is always appended to idle codes

## Pitfalls
- `getUserDesktopLoginConfig` must complete before site/team/dial-plan requests are constructed, while the five dependent promises remain all-or-nothing.
- The `aiFeature` section is part of the organization aggregate and must be passed into `parseAgentConfigs`; omitting it silently removes `Profile.aiFeature`.
- The team filter value must stay unquoted (`filter=userId=={dbId}`) — the quoted form returns HTTP 400 — and must not carry an `attributes=` projection, which would strip `multiMediaProfileId`, `teamType` and `siteName`.
- Team responses do not own channel configuration, and auxiliary-code requests require `desktopProfileFilter=true` during profile construction.

## Module Do's / Don'ts
- DO preserve the user-first dependency boundary and the exact five-promise result order.
- DO paginate team and auxiliary-code endpoints until their metadata indicates completion.
- DON'T return a partially assembled Profile after any required dependency fails.
- DON'T invent TeamList fields such as `channelMap` or omit `maskSensitiveData`/`aiFeature` mappings.

## Key Design Trade-off
- Profile creation is all-or-nothing across dependent API calls so consumers never receive internally inconsistent partial configuration.

## Test-Case Strategy (module)
`test/unit/spec/services/config/index.ts` must cover staged user-first orchestration, five-promise aggregation, AI-feature mapping, conditional dial plan, the `userDbId` team filter, pagination, auxiliary-code URL filtering, real response field names, and whole-profile rejection on any required failure.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `CONFIG-R-001` | `test/unit/spec/services/config/index.ts` | None. |
| `CONFIG-R-002` | `test/unit/spec/services/config/index.ts` | None. |
| `CONFIG-R-003` | `test/unit/spec/services/config/index.ts` | None. |
| `CONFIG-R-004` | `test/unit/spec/services/config/index.ts` | None. |
| `CONFIG-R-005` | `test/unit/spec/services/config/index.ts` | Keep an explicit rejection assertion for each required dependency category. |
| `CONFIG-R-006` | `test/unit/spec/services/config/Util.ts` | None. |
| `CONFIG-R-007` | `test/unit/spec/services/config/index.ts` | None. |

## Traceability
- Repo architecture: `../../../../ai-docs/ARCHITECTURE.md` · Registry: `../../../../ai-docs/SPEC_INDEX.md`
- Coverage state and contracts baseline: `../../../../.sdd/manifest.json`

- [Root AGENTS.md](../../../../AGENTS.md) - Orchestrator and cross-scope rules

- [types.ts](../types.ts) - Type definitions

- [Util.ts](../Util.ts) - AgentProfile parsing utilities

- [constants.ts](../constants.ts) - API endpoints

- [index.ts](../index.ts) - Service implementation with all API methods

- [types.ts](../types.ts) - Complete type definitions and event constants

- [Util.ts](../Util.ts) - Profile parsing utilities (parseAgentConfigs, getFilterAuxCodes, etc.)

- [constants.ts](../constants.ts) - API endpoints, default values, and method names
