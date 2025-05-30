// making query params configurable for List Teams and List Aux Codes API
export const DEFAULT_PAGE = 0;
export const DEFAULT_PAGE_SIZE = 100;
export const AGENT_STATE_AVAILABLE_ID = '0';
export const AGENT_STATE_AVAILABLE = 'Available';
export const AGENT_STATE_AVAILABLE_DESCRIPTION = 'Agent is available to receive calls';
export const DEFAULT_AUXCODE_ATTRIBUTES = [
  'id',
  'isSystemCode',
  'name',
  'defaultCode',
  'workTypeCode',
  'active',
];

// Method names for config services
export const METHODS = {
  // AgentConfigService methods
  GET_AGENT_CONFIG: 'getAgentConfig',
  GET_USER_USING_CI: 'getUserUsingCI',
  GET_DESKTOP_PROFILE_BY_ID: 'getDesktopProfileById',
  GET_MULTIMEDIA_PROFILE_BY_ID: 'getMultimediaProfileById',
  GET_LIST_OF_TEAMS: 'getListOfTeams',
  GET_ALL_TEAMS: 'getAllTeams',
  GET_LIST_OF_AUX_CODES: 'getListOfAuxCodes',
  GET_ALL_AUX_CODES: 'getAllAuxCodes',
  GET_SITE_INFO: 'getSiteInfo',
  GET_ORG_INFO: 'getOrgInfo',
  GET_ORGANIZATION_SETTING: 'getOrganizationSetting',
  GET_TENANT_DATA: 'getTenantData',
  GET_URL_MAPPING: 'getURLMapping',
  GET_DIAL_PLAN_DATA: 'getDialPlanData',
  GET_QUEUES: 'getQueues',

  // Util methods
  PARSE_AGENT_CONFIGS: 'parseAgentConfigs',
  GET_URL_MAPPING_UTIL: 'getUrlMapping',
  GET_MSFT_CONFIG: 'getMsftConfig',
  GET_WEBEX_CONFIG: 'getWebexConfig',
  GET_DEFAULT_AGENT_DN: 'getDefaultAgentDN',
  GET_FILTERED_DIALPLAN_ENTRIES: 'getFilteredDialplanEntries',
  GET_FILTER_AUX_CODES: 'getFilterAuxCodes',
  GET_DEFAULT_WRAP_UP_CODE: 'getDefaultWrapUpCode',
};

export const endPointMap = {
  userByCI: (orgId: string, agentId: string) =>
    `organization/${orgId}/user/by-ci-user-id/${agentId}`,
  desktopProfile: (orgId: string, desktopProfileId: string) =>
    `organization/${orgId}/agent-profile/${desktopProfileId}`,
  multimediaProfile: (orgId: string, multimediaProfileId: string) =>
    `organization/${orgId}/multimedia-profile/${multimediaProfileId}`,
  listTeams: (orgId: string, page: number, pageSize: number, filter: string[]) =>
    `organization/${orgId}/v2/team?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=(${filter})` : ''
    }`,
  listAuxCodes: (
    orgId: string,
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ) =>
    `organization/${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=(${filter})` : ''
    }&attributes=${attributes}`,
  orgInfo: (orgId: string) => `organization/${orgId}`,
  orgSettings: (orgId: string) => `organization/${orgId}/v2/organization-setting?agentView=true`,
  siteInfo: (orgId: string, siteId: string) => `organization/${orgId}/site/${siteId}`,
  tenantData: (orgId: string) => `organization/${orgId}/v2/tenant-configuration?agentView=true`,
  urlMapping: (orgId: string) => `organization/${orgId}/v2/org-url-mapping?sort=name,ASC`,
  dialPlan: (orgId: string) => `organization/${orgId}/dial-plan?agentView=true`,
  queueList: (orgId: string, queryParams: string) =>
    `organization/${orgId}/v2/contact-service-queue?${queryParams}`,
};
