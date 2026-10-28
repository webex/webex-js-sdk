// making query params configurable for List Teams and List Aux Codes API
export const DEFAULT_PAGE = 0;

/** Desktop Profile access levels for collaboration destination categories. */
export const COLLABORATION_ACCESS = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
  NONE: 'NONE',
} as const;

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

/** System idle-code name reserved for Agent Wellness Break. */
export const WELLBEING_BREAK_IDLE_CODE = 'WellbeingBreak';

/** Backend sentinel indicating wellness-break reminders are enabled. @internal */
export const WELLNESS_BREAK_REMINDERS_ENABLED = 'ENABLED';

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
  GET_ORG_DESKTOP_LOGIN_CONFIG: 'getOrgDesktopLoginConfig',
  GET_USER_DESKTOP_LOGIN_CONFIG: 'getUserDesktopLoginConfig',
  GET_MULTIMEDIA_PROFILE_BY_ID: 'getMultimediaProfileById',
  GET_LIST_OF_TEAMS: 'getListOfTeams',
  GET_ALL_TEAMS: 'getAllTeams',
  GET_LIST_OF_AUX_CODES: 'getListOfAuxCodes',
  GET_ALL_AUX_CODES: 'getAllAuxCodes',
  GET_SITE_INFO: 'getSiteInfo',
  GET_DIAL_PLAN_DATA: 'getDialPlanData',
  GET_WELLBEING_BREAK_IDLE_CODE: 'getWellbeingBreakIdleCode',
  GET_QUEUES: 'getQueues',

  // Util methods
  PARSE_AGENT_CONFIGS: 'parseAgentConfigs',
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
 * const url = endPointMap.userDesktopLogin('org123', 'agent456');
 */
export const endPointMap = {
  /**
   * Gets the endpoint for the aggregated organization desktop-login configuration.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.orgDesktopLogin('org123');
   * @ignore
   */
  orgDesktopLogin: (orgId: string) => `organization/${orgId}/desktop-login`,

  /**
   * Gets the endpoint for the aggregated user desktop-login configuration.
   * @param orgId - Organization ID.
   * @param ciUserId - CI user ID of the agent.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.userDesktopLogin('org123', 'agent456');
   * @ignore
   */
  userDesktopLogin: (orgId: string, ciUserId: string) =>
    `organization/${orgId}/v2/user/by-ci-user-id/${ciUserId}/desktop-login`,

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
   * Gets the endpoint for listing the teams a user belongs to.
   * The filter value must stay unquoted — the quoted form returns HTTP 400.
   * @param orgId - Organization ID.
   * @param page - Page number.
   * @param pageSize - Page size.
   * @param userDbId - Database ID of the user whose teams are requested.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.listTeams('org123', 0, 100, 'userDb456');
   * @ignore
   */
  listTeams: (orgId: string, page: number, pageSize: number, userDbId: string) =>
    `organization/${orgId}/v2/team?page=${page}&pageSize=${pageSize}` +
    `&agentView=true&filter=userId==${userDbId}`,

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
    }&attributes=${attributes}&desktopProfileFilter=true`,

  /** Lists system idle codes without applying the agent Desktop Profile filter. */
  systemIdleCodes: (orgId: string, page: number, pageSize: number) =>
    `organization/${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}` +
    '&workType=IDLE_CODE&customFilter=isSystemCode==true&desktopProfileFilter=false',

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
   * Gets the desktop-profile-filtered dial-number mappings used by entry-point destination lists.
   * @param orgId - Organization ID.
   * @param queryParams - Query parameters string.
   * @returns The endpoint URL string.
   * @ignore
   */
  entryPointDialNumberList: (orgId: string, queryParams: string) =>
    `/organization/${orgId}/v3/dial-number?${queryParams}`,
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

  /**
   * Gets the endpoint for outdial ANI entries with custom query parameters.
   * @param orgId - Organization ID.
   * @param outdialANI - Outdial ANI ID.
   * @param queryParams - Query parameters string.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.outdialAniEntries('org123', 'ani456', 'page=0&pageSize=10');
   * @ignore
   */
  outdialAniEntries: (orgId: string, outdialANI: string, queryParams: string) =>
    `organization/${orgId}/v2/outdial-ani/${outdialANI}/entry${
      queryParams ? `?${queryParams}` : ''
    }`,

  /**
   * Gets the endpoint for user preference by user ID.
   * @param orgId - Organization ID.
   * @param userId - User ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.userPreference('org123', 'user456');
   * @ignore
   */
  userPreference: (orgId: string, userId: string) =>
    `organization/${orgId}/user-preference/${userId}`,

  /**
   * Gets the endpoint for creating user preference.
   * @param orgId - Organization ID.
   * @returns The endpoint URL string.
   * @public
   * @example
   * const url = endPointMap.userPreferenceCreate('org123');
   * @ignore
   */
  userPreferenceCreate: (orgId: string) => `organization/${orgId}/user-preference`,
};
