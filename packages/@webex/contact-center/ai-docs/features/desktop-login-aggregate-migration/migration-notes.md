# Consumer migration notes — desktop-login aggregate

> Release notes source for the major version that ships `contact-center.desktop-login-aggregate`
> (see [`ai-docs/CONTRACTS.md`](../../CONTRACTS.md)). Copy into the published changelog at release.

`cc.register()` now builds the agent profile from the two desktop-login aggregate endpoints instead
of eleven individual configuration calls. `Profile` is unchanged in shape apart from the removals
listed below, so most consumers need no code change. The breaking surface is the exported types and
the service methods behind them.

## Removed exports

| Removed | Replacement |
|---|---|
| `DesktopProfileResponse` | `AgentProfile` — the same section, now reached through `UserDesktopLoginResponse.agentProfile`. Fields the aggregate does not return were dropped: `id`, `name`, `description`, `parentType`, `screenPopup`, `wrapUpCodes`, `idleCodes`, `autoAnswer`, `queues`, `entryPoints`, `buddyTeams`, `agentDNValidationCriterions`, `dialPlans`, `thresholdRules`, `active`, `systemDefault`, `createdTime`, `lastUpdatedTime`, and the four `showUserDetails*` / `stateSynchronization*` flags |
| `URLMapping` | `OrgUrlMappings` — a keyed object (`ACQUEON_API_URL`, `ACQUEON_CONSOLE_URL`) rather than a `{name, url}` list. `Profile.urlMappings` keeps its existing `{acqueonApiUrl, acqueonConsoleUrl}` shape |
| `MicrosoftConfig` / `WebexConfig` | New org-level types on `OrgDesktopLoginResponse`, replacing the per-agent `showUserDetails*` / `stateSynchronization*` flags on the Desktop Profile |
| `AIFeatureFlagsResponse` | `AIFeatureFlags` on `OrgDesktopLoginResponse.aiFeature`. The `{meta, data[]}` envelope is gone; `Profile.aiFeature` is unchanged |
| `Profile.environment` | No replacement. The aggregate does not return it |

## Removed service methods

`getUserUsingCI`, `getDesktopProfileById`, `getOrgInfo`, `getOrganizationSetting`, `getTenantData`,
`getURLMapping` and `getAIFeatureFlags` are replaced by `getOrgDesktopLoginConfig(orgId)` and
`getUserDesktopLoginConfig(orgId, ciUserId)`. `getSiteInfo`, `getAllTeams`, `getAllAuxCodes`,
`getDialPlanData`, `getMultimediaProfileById` and `getOutdialAniEntries` are unchanged in purpose.

## Changed signatures

`getListOfTeams(orgId, page, pageSize, userDbId: string)` and `getAllTeams(orgId, pageSize, userDbId: string)`
take the user's database id — `user.dbId` from the user aggregate, **not** the CI user id — in place of
the former `filter: string[]` team-id list. Callers that passed team ids must pass `dbId` instead. The
backend filter field is still named `userId` on the wire; only the SDK parameter name differs.

## Changed values

| Field | Change |
|---|---|
| `Profile.callVariablesSuppressed` | `string` → `boolean` |
| `Profile.idleCodes` / `wrapupCodes` | The aggregate returns the full organization pool, so agents on a `SPECIFIC` access level now receive every active code of that work type. `Profile.idleCodesAccess` / `wrapupCodesAccess` still report `ALL` or `SPECIFIC` |
| `Profile.teams` | Retyped from `Team[]` (`teamId`, `teamName`) to `TeamList[]` (`id`, `name`, …) to match what the team API has always returned. Consumers reading `teams[n].teamId` / `teamName` were already getting `undefined` and must switch to `id` / `name` |
| `Profile.webexConfig.stateSynchronizationWebex` | Now sourced from organization-level configuration, so it may read `true` where the agent-level value read `false` |
| `Profile.microsoftConfig` / `webexConfig` | Sourced from organization level; both flags default to `false` when the organization omits the section |
| `Profile.dialPlanEntity` | Built from every `active` dial plan in the organization rather than the subset named on the agent profile |
| `Profile.aiFeature` | No longer carries `id`, `links`, `createdTime` or `lastUpdatedTime` |
| `Profile.multimediaProfileId` | Resolved from the team value, falling back to the site value. The agent-level value is no longer available |
