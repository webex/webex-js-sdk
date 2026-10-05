# Config Service - Architecture

> **Legacy/reference-only.** Canonical SDD: [`config-spec.md`](config-spec.md). Use the package [manifest](../../../../.sdd/manifest.json) and [`SPEC_INDEX.md`](../../../../ai-docs/SPEC_INDEX.md) for routing; code and tests remain the behavioral referee.

> **Purpose**: Technical documentation for agent configuration aggregation.

---

## Component Overview

| Component | File | Responsibility |
|-----------|------|----------------|
| `AgentConfigService` | `config/index.ts` | Main config service class |
| `parseAgentConfigs` | `config/Util.ts` | Profile parsing/aggregation |
| `endPointMap` | `config/constants.ts` | API endpoint definitions |
| `types` | `config/types.ts` | Types, events, interfaces |

---

## Data Flow

```mermaid
sequenceDiagram
    participant CC as ContactCenter
    participant Cfg as AgentConfigService
    participant WR as WebexRequest
    participant API as Backend APIs

    CC->>Cfg: getAgentConfig(orgId, agentId)

    par Wave 1 — fire immediately
        Cfg->>WR: getUserDesktopLoginConfig
        Cfg->>WR: getOrgDesktopLoginConfig
        Cfg->>WR: getAllAuxCodes
    end

    WR->>API: 3 parallel API calls
    API-->>WR: Responses
    Note over Cfg: await userConfig (supplies dbId, siteId, dialPlanEnabled)

    par Wave 2 — depends on userConfig
        Cfg->>WR: getSiteInfo(user.siteId)
        Cfg->>WR: getAllTeams(user.dbId)
        Cfg->>WR: getDialPlanData (only if agentProfile.dialPlanEnabled)
    end

    Note over Cfg: Single Promise.all() awaits 5 promises<br/>(org aggregate + aux codes + site + teams + conditional dialPlan)
    Note over Cfg: multimediaProfileId = team value, else site value

    WR->>API: Remaining API calls
    API-->>WR: Responses

    Cfg->>Cfg: parseAgentConfigs(allData)
    Cfg-->>CC: Profile
```

---

## API Endpoints

The config service uses multiple API endpoints to fetch agent configuration data. These endpoints are defined in `constants.ts` and include:

- **User desktop-login aggregate**: agent identity plus the `agentProfile` section in one call
- **Organization desktop-login aggregate**: organization info, organization settings, tenant configuration, URL mappings, AI feature, Microsoft/Webex config in one call
- **Team & site**: Team memberships filtered by the agent's `userId`, plus site information
- **Auxiliary codes**: Idle codes and wrap-up codes with pagination
- **Communication settings**: Dial plans, multimedia profiles
- **Outbound features**: Queue lists, entry points, address books, outdial ANI entries

### Endpoint Definitions

All endpoints are relative to the WCC API Gateway base URL. Query parameters like `agentView=true` filter responses to agent-relevant data.

**Example Usage:**
```typescript
// Fetch the user desktop-login aggregate
const resource = endPointMap.userDesktopLogin('org-123', 'agent-456');
// Result: "organization/org-123/v2/user/by-ci-user-id/agent-456/desktop-login"

// Fetch teams with pagination, filtered by the user's database id
const resource = endPointMap.listTeams('org-123', 0, 100, 'user-db-id');
// Result: "organization/org-123/v2/team?page=0&pageSize=100&agentView=true&filter=userId==user-db-id"

// Fetch the organization desktop-login aggregate
const resource = endPointMap.orgDesktopLogin('org-123');
// Result: "organization/org-123/desktop-login"
```

**Full Endpoint Map:**
```typescript
export const endPointMap = {
  orgDesktopLogin: (orgId: string) =>
    `organization/${orgId}/desktop-login`,

  userDesktopLogin: (orgId: string, ciUserId: string) =>
    `organization/${orgId}/v2/user/by-ci-user-id/${ciUserId}/desktop-login`,

  multimediaProfile: (orgId: string, multimediaProfileId: string) =>
    `organization/${orgId}/multimedia-profile/${multimediaProfileId}`,

  // The filter value must stay unquoted — the quoted form returns HTTP 400.
  listTeams: (orgId: string, page: number, pageSize: number, userDbId: string) =>
    `organization/${orgId}/v2/team?page=${page}&pageSize=${pageSize}` +
    `&agentView=true&filter=userId==${userDbId}`,

  listAuxCodes: (orgId: string, page: number, pageSize: number, filter: string[], attributes: string[]) =>
    `organization/${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=(${filter})` : ''
    }&attributes=${attributes}`,

  siteInfo: (orgId: string, siteId: string) =>
    `organization/${orgId}/site/${siteId}`,

  dialPlan: (orgId: string) =>
    `organization/${orgId}/dial-plan?agentView=true`,

  queueList: (orgId: string, queryParams: string) =>
    `/organization/${orgId}/v2/contact-service-queue?${queryParams}`,

  entryPointDialNumberList: (orgId: string, queryParams: string) =>
    `/organization/${orgId}/v3/dial-number?${queryParams}`,

  addressBookEntries: (orgId: string, addressBookId: string, queryParams: string) =>
    `/organization/${orgId}/v2/address-book/${addressBookId}/entry?${queryParams}`,

  outdialAniEntries: (orgId: string, outdialANI: string, queryParams: string) =>
    `organization/${orgId}/v2/outdial-ani/${outdialANI}/entry${
      queryParams ? `?${queryParams}` : ''
    }`,
};
```

---

## Pagination Pattern

For endpoints with pagination (teams, aux codes):

```typescript
import {DEFAULT_PAGE} from './constants'; // DEFAULT_PAGE = 0

public async getAllTeams(orgId, pageSize, filter): Promise<TeamList[]> {
  let allTeams: TeamList[] = [];
  let page = DEFAULT_PAGE;
  
  // First request to get totalPages
  const firstResponse = await this.getListOfTeams(orgId, page, pageSize, filter);
  allTeams = allTeams.concat(firstResponse.data);
  const totalPages = firstResponse.meta.totalPages;
  
  // Parallel requests for remaining pages
  const requests = [];
  for (page = DEFAULT_PAGE + 1; page < totalPages; page += 1) {
    requests.push(this.getListOfTeams(orgId, page, pageSize, filter));
  }
  
  const responses = await Promise.all(requests);
  for (const response of responses) {
    allTeams = allTeams.concat(response.data);
  }
  
  return allTeams;
}
```

---

## Profile Parsing

`parseAgentConfigs` in Util.ts combines all data into a unified `Profile` object. See [types.ts](../types.ts) for full type definitions.

### API Response Structures

The service fetches data from multiple APIs with these response structures:

| API Method | Response Type | Key Fields | Usage |
|------------|---------------|------------|-------|
| `getUserDesktopLoginConfig` | `UserDesktopLoginResponse` | `user`: `ciUserId`, `id`, `dbId`, `firstName`, `lastName`, `email`, `agentProfileId`, `siteId`. `agentProfile`: `dialPlanEnabled`, `accessWrapUpCode`, `accessIdleCode`, `loginVoiceOptions`, `viewableStatistics` | Agent identity, team-filter id, site reference, and desktop settings in one call |
| `getOrgDesktopLoginConfig` | `OrgDesktopLoginResponse` | `organization`: `tenantId`, `timezone`. `organizationSetting`: `webRtcEnabled`, `maskSensitiveData`, `campaignManagerEnabled`, `aiAssistantQuantity`. `tenantConfiguration`: `outdialEnabled`, `forceDefaultDn`, `privacyShieldVisible`, `timeoutDesktopInactivityEnabled`. Optional `urlMappings`, `aiFeature`, `microsoftConfig`, `webexConfig` | All organization-, tenant- and feature-scoped configuration in one call |
| `getAllTeams` | `TeamList[]` | `id`, `name`, `teamType`, `siteId`, `siteName`, `multiMediaProfileId` (+ more) | Team details for the teams the agent belongs to |
| `getAllAuxCodes` | `AuxCode[]` | `id`, `name`, `workTypeCode`, `active`, `isSystemCode`, `defaultCode` | Auxiliary codes for idle/wrap-up states |
| `getDialPlanData` | `DialPlanEntity[]` | `id`, `name`, `regularExpression`, `prefix`, `strippedChars`, `active` | Dial plan rules for outbound calling |
| `getSiteInfo` | `SiteInfo` | Site-specific configuration | Site details, including the `multimediaProfileId` fallback |

These responses are parsed and aggregated into a single `Profile` object by the `parseAgentConfigs` function.

### Profile Aggregation Function

```typescript
// See full implementation in Util.ts
function parseAgentConfigs(profileData: {
  orgConfig: OrgDesktopLoginResponse;   // See types.ts:OrgDesktopLoginResponse
  userData: AgentResponse;              // `user` section; see types.ts:AgentResponse
  agentProfileData: AgentProfile;       // `agentProfile` section; see types.ts:AgentProfile
  teamData: Team[];                     // NOTE: Declared as Team[] (teamId, teamName) but receives TeamList[] (id, name, + 12 more fields) at runtime
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
    teams: teamData,                     // NOTE: Raw TeamList[] passed directly without mapping
    idleCodes,                           // NOTE: Filtered via getFilterAuxCodes() + hardcoded "Available" state
    wrapupCodes,                         // NOTE: Filtered via getFilterAuxCodes()
    webRtcEnabled: orgSettingsData.webRtcEnabled,
    loginVoiceOptions: agentProfileData.loginVoiceOptions ?? [],
    enterpriseId: orgInfoData.tenantId,
    tenantTimezone: orgInfoData.timezone,
    multimediaProfileId: profileData.multimediaProfileId,
    // ... 30+ more fields — see Util.ts:184-258 for full implementation
  };
}
```

---

## Error Handling

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

---

## Troubleshooting

### Common Issues and Log Patterns

#### Issue: Profile incomplete or getAgentConfig fails

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

#### Issue: Empty teams or aux codes

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

#### Issue: WebRTC or other features not enabled

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

#### Issue: Missing dial plan data

**Cause**: `dialPlanEnabled` is false in desktop profile

**Solution**:
1. Check `agentProfileData.dialPlanEnabled` value
2. Verify dial plans are assigned in agent profile configuration
3. Note: dial plan fetch only happens if `dialPlanEnabled === true`

#### Issue: Expected auxiliary codes missing from the returned pool

**Log patterns:**
```typescript
"method": "getFilterAuxCodes"
```

**Solution**:
1. `getFilterAuxCodes` no longer applies a per-agent restriction list — the full organization pool is returned for every agent
2. `Profile.idleCodesAccess` / `wrapupCodesAccess` still report `ALL` or `SPECIFIC` from `agentProfileData`
3. Ensure aux codes have `active: true` status and the expected `workTypeCode`
4. Note: "Available" state is always appended to idle codes

---

## Types and Events

The config service defines comprehensive TypeScript types for all data structures. See [types.ts](../types.ts) for complete definitions.

### Core Types

**Configuration Types:**
- `Profile` - Unified agent profile after aggregation
- `OrgDesktopLoginResponse` - Organization desktop-login aggregate
- `UserDesktopLoginResponse` - User desktop-login aggregate (`user` + `agentProfile`)
- `AgentResponse` - `user` section of the user aggregate
- `AgentProfile` - `agentProfile` section of the user aggregate
- `TeamList` - Team data with full details (id, name, teamType, siteId, multiMediaProfileId, etc.)
- `Team` - Simplified team reference (teamId, teamName, desktopLayoutId)
- `AuxCode` - Auxiliary code definition
- `Entity` - Filtered code entity (used for idle/wrapup codes in Profile)

**Organization Types:**
- `OrgInfo` - Organization metadata
- `OrgSettings` - Organization-level feature flags
- `TenantData` - Tenant configuration and feature enablement
- `SiteInfo` - Site-specific configuration

**Communication Types:**
- `DialPlanEntity` - Dial plan rule definition (includes `active`)
- `OrgUrlMappings` - Keyed external service URL mappings
- `OrgMicrosoftConfig` / `OrgWebexConfig` - Org-level presence configuration
- `MultimediaProfile` - Multimedia profile configuration

**Note:** The config service itself does not emit events. For agent and task events, see the Agent and Task services. Event constants are defined in [types.ts](../types.ts) under `CC_AGENT_EVENTS` and `CC_TASK_EVENTS`.

---

## Related Files

- [index.ts](../index.ts) - Service implementation with all API methods
- [types.ts](../types.ts) - Complete type definitions and event constants
- [Util.ts](../Util.ts) - Profile parsing utilities (parseAgentConfigs, getFilterAuxCodes, etc.)
- [constants.ts](../constants.ts) - API endpoints, default values, and method names
