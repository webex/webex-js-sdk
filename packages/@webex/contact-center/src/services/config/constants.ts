// making query params configurable for List Teams and List Aux Codes API
export const DEFAULT_PAGE = 0;

/**
 * Default page size for paginated API requests.
 * @type {number}
 * @public
 * @example
 * const pageSize = DEFAULT_PAGE_SIZE; // 100
 * @ignore
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Agent state ID for 'Available'.
 * @type {string}
 * @public
 * @ignore
 */
export const AGENT_STATE_AVAILABLE_ID = '0';

/**
 * Agent state label for 'Available'.
 * @type {string}
 * @public
 * @ignore
 */
export const AGENT_STATE_AVAILABLE = 'Available';

/**
 * Description for the 'Available' agent state.
 * @type {string}
 * @public
 * @ignore
 */
export const AGENT_STATE_AVAILABLE_DESCRIPTION = 'Agent is available to receive calls';

/**
 * Default attributes for auxiliary code API requests.
 * @type {string[]}
 * @public
 * @ignore
 */
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

/**
 * Maps API endpoint names to functions that generate endpoint URLs for various organization resources.
 * @public
 * @example
 * const url = endPointMap.userByCI('org123', 'agent456');
 */
export const endPointMap = {
  /**
   * Gets the endpoint for a user by CI user ID.
   * @param orgId - Organization ID.
   * @param agentId - Agent ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.userByCI('org123', 'agent456');
   * @ignore
   */
  userByCI: (orgId: string, agentId: string) =>
    `organization/${orgId}/user/by-ci-user-id/${agentId}`,

  /**
   * Gets the endpoint for a desktop profile.
   * @param orgId - Organization ID.
   * @param desktopProfileId - Desktop profile ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.desktopProfile('org123', 'profile789');
   * @ignore
   */
  desktopProfile: (orgId: string, desktopProfileId: string) =>
    `organization/${orgId}/agent-profile/${desktopProfileId}`,

  /**
   * Gets the endpoint for a multimedia profile.
   * @param orgId - Organization ID.
   * @param multimediaProfileId - Multimedia profile ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.multimediaProfile('org123', 'multi456');
   * @ignore
   */
  multimediaProfile: (orgId: string, multimediaProfileId: string) =>
    `organization/${orgId}/multimedia-profile/${multimediaProfileId}`,

  /**
   * Gets the endpoint for listing teams with optional filters.
   * @param orgId - Organization ID.
   * @param page - Page number.
   * @param pageSize - Page size.
   * @param filter - Array of team IDs to filter.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.listTeams('org123', 0, 100, ['team1', 'team2']);
   * @ignore
   */
  listTeams: (orgId: string, page: number, pageSize: number, filter: string[]) =>
    `organization/${orgId}/v2/team?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=(${filter})` : ''
    }`,

  /**
   * Gets the endpoint for listing auxiliary codes with optional filters and attributes.
   * @param orgId - Organization ID.
   * @param page - Page number.
   * @param pageSize - Page size.
   * @param filter - Array of auxiliary code IDs to filter.
   * @param attributes - Array of attribute names to include.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.listAuxCodes('org123', 0, 100, ['aux1'], ['id', 'name']);
   * @ignore
   */
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

  /**
   * Gets the endpoint for organization info.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.orgInfo('org123');
   * @ignore
   */
  orgInfo: (orgId: string) => `organization/${orgId}`,

  /**
   * Gets the endpoint for organization settings.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.orgSettings('org123');
   * @ignore
   */
  orgSettings: (orgId: string) => `organization/${orgId}/v2/organization-setting?agentView=true`,

  /**
   * Gets the endpoint for site info.
   * @param orgId - Organization ID.
   * @param siteId - Site ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.siteInfo('org123', 'site456');
   * @ignore
   */
  siteInfo: (orgId: string, siteId: string) => `organization/${orgId}/site/${siteId}`,

  /**
   * Gets the endpoint for tenant configuration data.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.tenantData('org123');
   * @ignore
   */
  tenantData: (orgId: string) => `organization/${orgId}/v2/tenant-configuration?agentView=true`,

  /**
   * Gets the endpoint for organization URL mapping.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.urlMapping('org123');
   * @ignore
   */
  urlMapping: (orgId: string) => `organization/${orgId}/v2/org-url-mapping?sort=name,ASC`,

  /**
   * Gets the endpoint for dial plan.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.dialPlan('org123');
   * @ignore
   */
  dialPlan: (orgId: string) => `organization/${orgId}/dial-plan?agentView=true`,

  /**
   * Gets the endpoint for the queue list with custom query parameters.
   * @param orgId - Organization ID.
   * @param queryParams - Query parameters string.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.queueList('org123', 'page=0&pageSize=10');
   * @ignore
   */
  queueList: (orgId: string, queryParams: string) =>
    `/organization/${orgId}/v2/contact-service-queue?${queryParams}`,
  /**
   * Gets the endpoint for entry points list with custom query parameters.
   * @param orgId - Organization ID.
   * @param queryParams - Query parameters string.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.entryPointList('org123', 'page=0&pageSize=10');
   * @ignore
   */
  entryPointList: (orgId: string, queryParams: string) =>
    `/organization/${orgId}/v2/entry-point?${queryParams}`,
  /**
   * Gets the endpoint for address book entries with custom query parameters.
   * @param orgId - Organization ID.
   * @param addressBookId - Address book ID.
   * @param queryParams - Query parameters string.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.addressBookEntries('org123', 'book456', 'page=0&pageSize=10');
   * @ignore
   */
  addressBookEntries: (orgId: string, addressBookId: string, queryParams: string) =>
    `/organization/${orgId}/v2/address-book/${addressBookId}/entry?${queryParams}`,
};
